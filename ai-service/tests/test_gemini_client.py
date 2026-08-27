"""Tests for Google Gemini client wrapper."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from pydantic import BaseModel

from app.clients.gemini_client import GeminiClient
from app.core.config import Settings


class SampleSchema(BaseModel):
    name: str


def test_gemini_client_generate_structured_uses_response_schema() -> None:
    settings = Settings()
    mock_parsed = SampleSchema(name="test")

    with patch("app.clients.gemini_client.genai.Client") as client_cls:
        sdk = MagicMock()
        response = MagicMock()
        response.parsed = mock_parsed
        sdk.models.generate_content.return_value = response
        client_cls.return_value = sdk

        client = GeminiClient(settings)
        result = client.generate_structured("prompt", SampleSchema)

    assert result is mock_parsed
    sdk.models.generate_content.assert_called_once()
    call_kwargs = sdk.models.generate_content.call_args.kwargs
    assert call_kwargs["model"] == "gemini-2.5-flash"
    assert call_kwargs["contents"] == "prompt"
    assert call_kwargs["config"].response_mime_type == "application/json"
    assert call_kwargs["config"].response_schema is SampleSchema
