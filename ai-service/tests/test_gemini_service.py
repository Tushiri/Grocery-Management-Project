"""Tests for Gemini structured extraction service."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.schemas.receipt import GeminiLineExtraction
from app.services.gemini_service import GeminiExtractionError, GeminiService


def test_extract_structured_returns_validated_gemini_line_extraction() -> None:
    client = MagicMock()
    client.generate_structured.return_value = GeminiLineExtraction(
        standardized_name="Organic Milk",
        quantity=2.0,
        unit_price=3.5,
        total_price=7.0,
        category="Dairy",
        unit_type="gallon",
    )
    service = GeminiService(client)

    result = service.extract_structured("ORG MILK")

    assert result.standardized_name == "Organic Milk"
    assert result.quantity == 2.0
    client.generate_structured.assert_called_once_with(
        "Extract grocery receipt line item fields from this OCR text. OCR line: ORG MILK",
        GeminiLineExtraction,
    )


def test_extract_structured_validates_dict_response_from_client() -> None:
    client = MagicMock()
    client.generate_structured.return_value = {
        "standardized_name": "Organic Eggs",
        "quantity": 1.0,
        "unit_price": 4.0,
        "total_price": 4.0,
        "category": None,
        "unit_type": "dozen",
    }
    service = GeminiService(client)

    result = service.extract_structured("ORG EGGS")

    assert result.standardized_name == "Organic Eggs"
    assert result.unit_type == "dozen"


def test_extract_structured_raises_when_client_response_is_invalid() -> None:
    client = MagicMock()
    client.generate_structured.return_value = {
        "standardized_name": "Bad Item",
        "quantity": 0,
        "unit_price": -1.0,
        "total_price": 0.0,
    }
    service = GeminiService(client)

    with pytest.raises(GeminiExtractionError):
        service.extract_structured("BAD ITEM")
