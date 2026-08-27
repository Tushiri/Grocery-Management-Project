"""Tests for service-to-service token verification."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core.config import Settings
from app.core.security import verify_service_token


def _settings() -> Settings:
    return Settings()


@pytest.mark.asyncio
async def test_verify_service_token_rejects_missing_header() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await verify_service_token(_settings(), None)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid or missing X-Service-Token"


@pytest.mark.asyncio
async def test_verify_service_token_rejects_invalid_token() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await verify_service_token(_settings(), "wrong-token")

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_verify_service_token_accepts_valid_token() -> None:
    await verify_service_token(_settings(), "test-service-token")
