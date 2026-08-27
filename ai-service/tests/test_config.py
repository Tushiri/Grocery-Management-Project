"""Tests for typed settings loading."""

from __future__ import annotations

from app.core.config import Settings, get_settings


def test_settings_loads_required_fields_from_environment() -> None:
    settings = Settings()

    assert settings.supabase_url == "https://test.supabase.co"
    assert settings.supabase_service_role_key == "test-service-role"
    assert settings.gcp_vision_credentials_json == '{"type":"service_account"}'
    assert settings.gemini_api_key == "test-gemini-key"
    assert settings.ai_service_token == "test-service-token"


def test_get_settings_returns_cached_singleton() -> None:
    first = get_settings()
    second = get_settings()

    assert first is second
