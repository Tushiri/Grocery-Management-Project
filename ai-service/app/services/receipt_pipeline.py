"""Lookup-first receipt processing pipeline with Gemini fallback."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from app.clients.supabase_client import SupabaseServiceClient
from app.core.text_utils import normalize_ocr_string
from app.schemas.receipt import (
    GeminiLineExtraction,
    ParsedReceipt,
    ProcessReceiptRequest,
    ProcessReceiptResponse,
    ReceiptLineItem,
)
from app.services.gemini_service import GeminiService
from app.services.ocr_service import OcrLine, OcrService
from app.services.product_mapping_service import ProductMappingMatch, ProductMappingService


def _line_item_from_mapping(line: OcrLine, mapping: ProductMappingMatch) -> ReceiptLineItem:
    return ReceiptLineItem(
        raw_text=line.text,
        standardized_name=mapping.standardized_name,
        quantity=1.0,
        unit_price=0.0,
        total_price=0.0,
        matched_item_id=mapping.standardized_item_id,
        matched_via="lookup",
    )


def _line_item_from_gemini(
    line: OcrLine,
    extracted: GeminiLineExtraction,
    item_id: UUID,
) -> ReceiptLineItem:
    return ReceiptLineItem(
        raw_text=line.text,
        standardized_name=extracted.standardized_name,
        quantity=extracted.quantity,
        unit_price=extracted.unit_price,
        total_price=extracted.total_price,
        category=extracted.category,
        matched_item_id=item_id,
        matched_via="gemini",
    )


async def process_receipt(
    req: ProcessReceiptRequest,
    *,
    supabase: SupabaseServiceClient,
    ocr: OcrService,
    mapping: ProductMappingService,
    gemini: GeminiService,
) -> ProcessReceiptResponse:
    image_bytes = supabase.download_storage(req.storage_path)
    raw_lines = ocr.extract_lines(image_bytes)

    line_items: list[ReceiptLineItem] = []
    lookup_hits = 0
    gemini_hits = 0

    for line in raw_lines:
        match = mapping.find_exact_match(req.household_id, line.text)
        if match is not None:
            line_items.append(_line_item_from_mapping(line, match))
            lookup_hits += 1
            continue

        normalized = normalize_ocr_string(line.text)
        extracted = gemini.extract_structured(normalized)
        item_id = mapping.resolve_or_create_item(req.household_id, extracted)
        mapping.persist_mapping(req.household_id, normalized, item_id)
        line_items.append(_line_item_from_gemini(line, extracted, item_id))
        gemini_hits += 1

    parsed = ParsedReceipt(
        store_name="",
        date_purchased=date.today(),
        line_items=line_items,
    )
    supabase.update_pending_receipt_parsed_json(req.pending_receipt_id, parsed)

    return ProcessReceiptResponse(
        pending_receipt_id=req.pending_receipt_id,
        status="PENDING",
        parsed=parsed,
        matched_via_lookup_count=lookup_hits,
        matched_via_gemini_count=gemini_hits,
    )
