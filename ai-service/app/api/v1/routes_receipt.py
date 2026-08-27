"""Receipt processing API routes."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.v1.deps import (
    get_gemini_service,
    get_ocr_service,
    get_product_mapping_service,
    get_supabase_service_client,
)
from app.clients.supabase_client import SupabaseServiceClient
from app.core.security import verify_service_token
from app.schemas.receipt import (
    ApproveReceiptRequest,
    ApproveReceiptResponse,
    ProcessReceiptRequest,
    ProcessReceiptResponse,
    RejectReceiptResponse,
)
from app.services.gemini_service import GeminiService
from app.services.ocr_service import OcrService
from app.services.product_mapping_service import ProductMappingService
from app.services.receipt_pipeline import process_receipt
from app.services.reconciliation_service import approve_receipt, reject_receipt

router = APIRouter(prefix="/api", dependencies=[Depends(verify_service_token)])


@router.post("/process-receipt", response_model=ProcessReceiptResponse)
async def process_receipt_endpoint(
    req: ProcessReceiptRequest,
    supabase: Annotated[SupabaseServiceClient, Depends(get_supabase_service_client)],
    ocr: Annotated[OcrService, Depends(get_ocr_service)],
    mapping: Annotated[ProductMappingService, Depends(get_product_mapping_service)],
    gemini: Annotated[GeminiService, Depends(get_gemini_service)],
) -> ProcessReceiptResponse:
    return await process_receipt(
        req,
        supabase=supabase,
        ocr=ocr,
        mapping=mapping,
        gemini=gemini,
    )


@router.post(
    "/process-receipt/{pending_receipt_id}/approve",
    response_model=ApproveReceiptResponse,
)
async def approve_receipt_endpoint(
    pending_receipt_id: UUID,
    req: ApproveReceiptRequest,
    supabase: Annotated[SupabaseServiceClient, Depends(get_supabase_service_client)],
) -> ApproveReceiptResponse:
    try:
        return await approve_receipt(pending_receipt_id, req, supabase=supabase)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/process-receipt/{pending_receipt_id}/reject",
    response_model=RejectReceiptResponse,
)
async def reject_receipt_endpoint(
    pending_receipt_id: UUID,
    supabase: Annotated[SupabaseServiceClient, Depends(get_supabase_service_client)],
) -> RejectReceiptResponse:
    try:
        return await reject_receipt(pending_receipt_id, supabase=supabase)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
