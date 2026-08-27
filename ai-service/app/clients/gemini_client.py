"""Google Gemini client wrapper with structured JSON output."""

from __future__ import annotations

from typing import Any

from google import genai
from google.genai import types
from pydantic import BaseModel

from app.core.config import Settings

GEMINI_MODEL = "gemini-2.5-flash"


class GeminiClient:
    """Thin wrapper over google-genai structured generation."""

    def __init__(self, settings: Settings) -> None:
        self._client = genai.Client(api_key=settings.gemini_api_key)

    def generate_structured(
        self,
        prompt: str,
        response_schema: type[BaseModel],
    ) -> Any:
        response = self._client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=response_schema,
            ),
        )
        return response.parsed
