"""Tests for OCR text extraction via Cloud Vision."""

from __future__ import annotations

from unittest.mock import MagicMock

from app.services.ocr_service import OcrLine, OcrService


def _vision_response(full_text: str) -> MagicMock:
    annotation = MagicMock()
    annotation.description = full_text
    response = MagicMock()
    response.text_annotations = [annotation]
    return response


def test_extract_lines_splits_vision_text_into_non_empty_lines() -> None:
    vision = MagicMock()
    vision.detect_text.return_value = _vision_response("ORG MILK\n  ORG EGGS  \n")
    service = OcrService(vision)

    lines = service.extract_lines(b"fake-image")

    assert lines == [OcrLine(text="ORG MILK"), OcrLine(text="ORG EGGS")]
    vision.detect_text.assert_called_once_with(b"fake-image")


def test_extract_lines_returns_empty_list_when_vision_finds_no_text() -> None:
    vision = MagicMock()
    vision.detect_text.return_value = MagicMock(text_annotations=[])
    service = OcrService(vision)

    lines = service.extract_lines(b"blank")

    assert lines == []


def test_extract_lines_returns_empty_list_when_description_is_blank() -> None:
    vision = MagicMock()
    vision.detect_text.return_value = _vision_response("   \n  \n")
    service = OcrService(vision)

    lines = service.extract_lines(b"blank")

    assert lines == []
