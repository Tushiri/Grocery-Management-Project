"""Pydantic schemas for receipt processing requests and responses."""

from __future__ import annotations

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ReceiptLineItem(BaseModel):
    raw_text: str
    standardized_name: str
    quantity: float = Field(gt=0)
    unit_price: float = Field(ge=0)
    total_price: float = Field(ge=0)
    category: str | None = None
    matched_item_id: UUID | None = None
    matched_via: Literal["lookup", "gemini"]


class ParsedReceipt(BaseModel):
    store_name: str
    date_purchased: date
    line_items: list[ReceiptLineItem]


class ProcessReceiptRequest(BaseModel):
    pending_receipt_id: UUID
    household_id: UUID
    storage_path: str


class ProcessReceiptResponse(BaseModel):
    pending_receipt_id: UUID
    status: Literal["PENDING"]
    parsed: ParsedReceipt
    matched_via_lookup_count: int
    matched_via_gemini_count: int


class GeminiLineExtraction(BaseModel):
    """Strict schema sent to Gemini via response_schema."""

    standardized_name: str
    quantity: float = Field(gt=0)
    unit_price: float = Field(ge=0)
    total_price: float = Field(ge=0)
    category: str | None = None
    unit_type: str = "unit"


class ApproveReceiptRequest(BaseModel):
    line_items: list[ReceiptLineItem]


class ApproveReceiptResponse(BaseModel):
    pending_receipt_id: UUID
    status: Literal["APPROVED"]


class RejectReceiptResponse(BaseModel):
    pending_receipt_id: UUID
    status: Literal["REJECTED"]
