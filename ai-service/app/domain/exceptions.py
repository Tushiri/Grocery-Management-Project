"""Domain-specific exceptions for receipt processing and reconciliation."""

from __future__ import annotations


class ReceiptNotFoundError(Exception):
    """Raised when a pending receipt does not exist."""


class InvalidReceiptStateError(Exception):
    """Raised when a receipt is not in the expected status for an operation."""


class InvalidReceiptMetadataError(Exception):
    """Raised when pending receipt metadata cannot be parsed."""


class InvalidInventoryDataError(Exception):
    """Raised when inventory lookup returns malformed data."""


class GeminiExtractionError(Exception):
    """Raised when Gemini output cannot be validated against the schema."""
