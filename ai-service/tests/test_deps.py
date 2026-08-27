"""Tests for FastAPI dependency wiring."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import UUID

from app.api.v1.deps import (
    get_gemini_service,
    get_ocr_service,
    get_product_mapping_service,
    get_supabase_service_client,
)
from app.core.config import Settings

HOUSEHOLD_ID = UUID("11111111-1111-1111-1111-111111111111")


def test_get_supabase_service_client_creates_service_role_wrapper() -> None:
    settings = Settings()

    with patch("app.api.v1.deps.create_supabase_client") as create_client:
        sentinel = MagicMock()
        create_client.return_value = sentinel

        result = get_supabase_service_client(settings)

    create_client.assert_called_once_with(settings)
    assert result is sentinel


def test_get_ocr_service_builds_vision_backed_service() -> None:
    settings = Settings()

    with patch("app.api.v1.deps.VisionClient") as vision_cls:
        vision = MagicMock()
        vision.detect_text.return_value = MagicMock(text_annotations=[])
        vision_cls.return_value = vision

        service = get_ocr_service(settings)

    vision_cls.assert_called_once_with(settings)
    assert service.extract_lines(b"image") == []


def test_get_product_mapping_service_wraps_supabase_repository() -> None:
    supabase = MagicMock()
    supabase.find_product_mapping.return_value = None

    service = get_product_mapping_service(supabase)

    assert service.find_exact_match(HOUSEHOLD_ID, "ORG MILK") is None


def test_get_gemini_service_builds_structured_client() -> None:
    settings = Settings()

    with patch("app.api.v1.deps.GeminiClient") as gemini_cls:
        gemini_cls.return_value = MagicMock()
        service = get_gemini_service(settings)

    gemini_cls.assert_called_once_with(settings)
    assert service.extract_structured is not None
