"""Text normalization helpers for OCR output."""


def normalize_ocr_string(raw: str) -> str:
    """Trim, uppercase, and collapse internal whitespace to a single space."""
    return " ".join(raw.strip().upper().split())
