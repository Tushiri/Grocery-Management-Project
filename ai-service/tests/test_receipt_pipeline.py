"""Tests for lookup-first receipt processing pipeline and HTTP endpoints."""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.api.v1.deps import (
    get_gemini_service,
    get_ocr_service,
    get_product_mapping_service,
    get_supabase_service_client,
)
from app.main import app
from app.schemas.receipt import GeminiLineExtraction, ProcessReceiptRequest
from app.services.gemini_service import GeminiService
from app.services.ocr_service import OcrLine, OcrService
from app.services.product_mapping_service import ProductMappingMatch, ProductMappingService
from app.services.receipt_pipeline import process_receipt

HOUSEHOLD_ID = UUID("11111111-1111-1111-1111-111111111111")
RECEIPT_ID = UUID("33333333-3333-3333-3333-333333333333")
MILK_ID = UUID("22222222-2222-2222-2222-222222222222")
EGGS_ID = UUID("44444444-4444-4444-4444-444444444444")
NEW_ITEM_ID = UUID("66666666-6666-6666-6666-666666666666")


def _request() -> ProcessReceiptRequest:
    return ProcessReceiptRequest(
        pending_receipt_id=RECEIPT_ID,
        household_id=HOUSEHOLD_ID,
        storage_path=f"{HOUSEHOLD_ID}/receipt.jpg",
    )


def _mapping(item_id: UUID, name: str, raw: str) -> ProductMappingMatch:
    return ProductMappingMatch(
        standardized_item_id=item_id,
        standardized_name=name,
        raw_ocr_string=raw,
    )


def _gemini_extraction(name: str = "Unknown Spice") -> GeminiLineExtraction:
    return GeminiLineExtraction(
        standardized_name=name,
        quantity=1.0,
        unit_price=2.5,
        total_price=2.5,
        category="Pantry",
        unit_type="jar",
    )


@pytest.mark.asyncio
async def test_process_receipt_resolves_all_mapped_lines_without_gemini() -> None:
    supabase = MagicMock()
    supabase.download_storage.return_value = b"image-bytes"
    ocr = MagicMock(spec=OcrService)
    ocr.extract_lines.return_value = [
        OcrLine(text="ORG MILK"),
        OcrLine(text="ORG EGGS"),
    ]
    mapping = MagicMock(spec=ProductMappingService)
    mapping.find_exact_match.side_effect = [
        _mapping(MILK_ID, "Organic Milk", "ORG MILK"),
        _mapping(EGGS_ID, "Organic Eggs", "ORG EGGS"),
    ]
    gemini = MagicMock(spec=GeminiService)

    response = await process_receipt(
        _request(), supabase=supabase, ocr=ocr, mapping=mapping, gemini=gemini
    )

    assert response.matched_via_lookup_count == 2
    assert response.matched_via_gemini_count == 0
    gemini.extract_structured.assert_not_called()


@pytest.mark.asyncio
async def test_process_receipt_routes_unmapped_lines_to_gemini() -> None:
    supabase = MagicMock()
    supabase.download_storage.return_value = b"image-bytes"
    ocr = MagicMock(spec=OcrService)
    ocr.extract_lines.return_value = [
        OcrLine(text="ORG MILK"),
        OcrLine(text="UNKNOWN SPICE"),
    ]
    mapping = MagicMock(spec=ProductMappingService)
    mapping.find_exact_match.side_effect = [
        _mapping(MILK_ID, "Organic Milk", "ORG MILK"),
        None,
    ]
    extracted = _gemini_extraction()
    gemini = MagicMock(spec=GeminiService)
    gemini.extract_structured.return_value = extracted
    mapping.resolve_or_create_item.return_value = NEW_ITEM_ID

    response = await process_receipt(
        _request(), supabase=supabase, ocr=ocr, mapping=mapping, gemini=gemini
    )

    assert response.matched_via_lookup_count == 1
    assert response.matched_via_gemini_count == 1
    gemini.extract_structured.assert_called_once_with("UNKNOWN SPICE")
    mapping.persist_mapping.assert_called_once_with(HOUSEHOLD_ID, "UNKNOWN SPICE", NEW_ITEM_ID)
    gemini_line = response.parsed.line_items[1]
    assert gemini_line.matched_via == "gemini"
    assert gemini_line.quantity == 1.0
    assert gemini_line.unit_price == 2.5


@pytest.mark.asyncio
async def test_process_receipt_uses_placeholder_metadata_for_lookup_lines() -> None:
    supabase = MagicMock()
    supabase.download_storage.return_value = b"image-bytes"
    ocr = MagicMock(spec=OcrService)
    ocr.extract_lines.return_value = [OcrLine(text="ORG MILK")]
    mapping = MagicMock(spec=ProductMappingService)
    mapping.find_exact_match.return_value = _mapping(MILK_ID, "Organic Milk", "ORG MILK")
    gemini = MagicMock(spec=GeminiService)

    response = await process_receipt(
        _request(), supabase=supabase, ocr=ocr, mapping=mapping, gemini=gemini
    )

    assert response.parsed.store_name == ""
    assert response.parsed.date_purchased == date.today()
    line = response.parsed.line_items[0]
    assert line.quantity == 1.0
    assert line.unit_price == 0.0


def test_process_receipt_endpoint_requires_service_token() -> None:
    client = TestClient(app)

    response = client.post(
        "/api/process-receipt",
        json={
            "pending_receipt_id": str(RECEIPT_ID),
            "household_id": str(HOUSEHOLD_ID),
            "storage_path": f"{HOUSEHOLD_ID}/receipt.jpg",
        },
    )

    assert response.status_code == 401


def test_process_receipt_endpoint_returns_parsed_response() -> None:
    supabase = MagicMock()
    ocr = MagicMock(spec=OcrService)
    ocr.extract_lines.return_value = [OcrLine(text="ORG MILK")]
    mapping = MagicMock(spec=ProductMappingService)
    mapping.find_exact_match.return_value = _mapping(MILK_ID, "Organic Milk", "ORG MILK")
    gemini = MagicMock(spec=GeminiService)
    supabase.download_storage.return_value = b"image-bytes"

    app.dependency_overrides[get_supabase_service_client] = lambda: supabase
    app.dependency_overrides[get_ocr_service] = lambda: ocr
    app.dependency_overrides[get_product_mapping_service] = lambda: mapping
    app.dependency_overrides[get_gemini_service] = lambda: gemini

    try:
        client = TestClient(app)
        response = client.post(
            "/api/process-receipt",
            headers={"X-Service-Token": "test-service-token"},
            json={
                "pending_receipt_id": str(RECEIPT_ID),
                "household_id": str(HOUSEHOLD_ID),
                "storage_path": f"{HOUSEHOLD_ID}/receipt.jpg",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["matched_via_lookup_count"] == 1


def test_approve_receipt_endpoint_requires_service_token() -> None:
    client = TestClient(app)

    response = client.post(
        f"/api/process-receipt/{RECEIPT_ID}/approve",
        json={"line_items": []},
    )

    assert response.status_code == 401


def test_approve_and_reject_endpoints_return_expected_status() -> None:
    supabase = MagicMock()
    supabase.get_pending_receipt.return_value = {
        "id": str(RECEIPT_ID),
        "household_id": str(HOUSEHOLD_ID),
        "status": "PENDING",
        "store_name": "Test Store",
        "parsed_json": {"date_purchased": "2026-08-27"},
    }
    supabase.find_open_or_partial_to_buy.return_value = []

    app.dependency_overrides[get_supabase_service_client] = lambda: supabase

    try:
        client = TestClient(app)
        headers = {"X-Service-Token": "test-service-token"}
        approve = client.post(
            f"/api/process-receipt/{RECEIPT_ID}/approve",
            headers=headers,
            json={
                "line_items": [
                    {
                        "raw_text": "ORG MILK",
                        "standardized_name": "Organic Milk",
                        "quantity": 1.0,
                        "unit_price": 3.5,
                        "total_price": 3.5,
                        "matched_item_id": str(MILK_ID),
                        "matched_via": "lookup",
                    }
                ]
            },
        )
        reject = client.post(
            f"/api/process-receipt/{RECEIPT_ID}/reject",
            headers=headers,
        )
    finally:
        app.dependency_overrides.clear()

    assert approve.status_code == 200
    assert approve.json()["status"] == "APPROVED"
    assert reject.status_code == 200
    assert reject.json()["status"] == "REJECTED"


def test_approve_receipt_endpoint_returns_400_for_invalid_receipt() -> None:
    supabase = MagicMock()
    supabase.get_pending_receipt.return_value = None
    app.dependency_overrides[get_supabase_service_client] = lambda: supabase

    try:
        client = TestClient(app)
        response = client.post(
            f"/api/process-receipt/{RECEIPT_ID}/approve",
            headers={"X-Service-Token": "test-service-token"},
            json={"line_items": []},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404


def test_reject_receipt_endpoint_returns_404_for_invalid_receipt() -> None:
    supabase = MagicMock()
    supabase.get_pending_receipt.return_value = None
    app.dependency_overrides[get_supabase_service_client] = lambda: supabase

    try:
        client = TestClient(app)
        response = client.post(
            f"/api/process-receipt/{RECEIPT_ID}/reject",
            headers={"X-Service-Token": "test-service-token"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404


def test_process_receipt_endpoint_maps_storage_errors() -> None:
    from app.domain.exceptions import ReceiptNotFoundError

    supabase = MagicMock()
    supabase.download_storage.side_effect = ReceiptNotFoundError("image missing")
    app.dependency_overrides[get_supabase_service_client] = lambda: supabase
    app.dependency_overrides[get_ocr_service] = lambda: MagicMock(spec=OcrService)
    app.dependency_overrides[get_product_mapping_service] = lambda: MagicMock(
        spec=ProductMappingService
    )
    app.dependency_overrides[get_gemini_service] = lambda: MagicMock(spec=GeminiService)

    try:
        client = TestClient(app)
        response = client.post(
            "/api/process-receipt",
            headers={"X-Service-Token": "test-service-token"},
            json={
                "pending_receipt_id": str(RECEIPT_ID),
                "household_id": str(HOUSEHOLD_ID),
                "storage_path": f"{HOUSEHOLD_ID}/receipt.jpg",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json()["detail"] == "image missing"
