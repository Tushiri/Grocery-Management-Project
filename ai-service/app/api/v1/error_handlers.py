"""HTTP error mapping for receipt API routes."""

from __future__ import annotations

from fastapi import HTTPException, status

from app.domain.exceptions import (
    GeminiExtractionError,
    InvalidReceiptMetadataError,
    InvalidReceiptStateError,
    ReceiptNotFoundError,
)


def map_receipt_exception(exc: Exception) -> HTTPException:
    if isinstance(exc, ReceiptNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, InvalidReceiptStateError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, InvalidReceiptMetadataError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    if isinstance(exc, GeminiExtractionError):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    if isinstance(exc, FileNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=str(exc) if str(exc) else "Upstream service error",
    )
