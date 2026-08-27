"""Tests for receipt route error mapping."""

from __future__ import annotations

from fastapi import HTTPException, status

from app.api.v1.error_handlers import map_receipt_exception
from app.domain.exceptions import (
    GeminiExtractionError,
    InvalidReceiptMetadataError,
    InvalidReceiptStateError,
    ReceiptNotFoundError,
)


def test_map_receipt_exception_not_found() -> None:
    exc = map_receipt_exception(ReceiptNotFoundError("missing"))
    assert exc.status_code == status.HTTP_404_NOT_FOUND
    assert exc.detail == "missing"


def test_map_receipt_exception_invalid_state() -> None:
    exc = map_receipt_exception(InvalidReceiptStateError("not pending"))
    assert exc.status_code == status.HTTP_409_CONFLICT


def test_map_receipt_exception_invalid_metadata() -> None:
    exc = map_receipt_exception(InvalidReceiptMetadataError("bad metadata"))
    assert exc.status_code == status.HTTP_400_BAD_REQUEST


def test_map_receipt_exception_gemini() -> None:
    exc = map_receipt_exception(GeminiExtractionError("parse failed"))
    assert exc.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_map_receipt_exception_file_not_found() -> None:
    exc = map_receipt_exception(FileNotFoundError("receipt image"))
    assert exc.status_code == status.HTTP_404_NOT_FOUND


def test_map_receipt_exception_upstream() -> None:
    exc = map_receipt_exception(RuntimeError("sdk timeout"))
    assert exc.status_code == status.HTTP_502_BAD_GATEWAY
    assert exc.detail == "sdk timeout"


def test_map_receipt_exception_upstream_empty_message() -> None:
    exc = map_receipt_exception(RuntimeError())
    assert exc.status_code == status.HTTP_502_BAD_GATEWAY
    assert exc.detail == "Upstream service error"
