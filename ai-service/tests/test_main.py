"""Tests for FastAPI application endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_health_check_is_public() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "ai-service"}
