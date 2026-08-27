"""Gemini structured extraction for unmapped OCR receipt lines."""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from app.clients.gemini_client import GeminiClient
from app.domain.exceptions import GeminiExtractionError
from app.schemas.receipt import GeminiLineExtraction


class GeminiService:
    """Extracts structured line items from normalized OCR text."""

    def __init__(self, client: GeminiClient | Any) -> None:
        self._client = client

    def extract_structured(self, normalized_text: str) -> GeminiLineExtraction:
        prompt = (
            "Extract grocery receipt line item fields from this OCR text. "
            f"OCR line: {normalized_text}"
        )
        parsed = self._client.generate_structured(prompt, GeminiLineExtraction)
        try:
            if isinstance(parsed, GeminiLineExtraction):
                return parsed
            return GeminiLineExtraction.model_validate(parsed)
        except ValidationError as exc:
            raise GeminiExtractionError("Gemini response failed schema validation") from exc
