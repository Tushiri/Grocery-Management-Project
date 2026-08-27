"""Tests for Google Cloud Vision client wrapper."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

from app.clients.vision_client import VisionClient
from app.core.config import Settings


def test_vision_client_detect_text_calls_document_text_detection() -> None:
    credentials_json = json.dumps(
        {
            "type": "service_account",
            "project_id": "test-project",
            "private_key_id": "key-id",
            "private_key": "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n",
            "client_email": "vision@test-project.iam.gserviceaccount.com",
            "client_id": "123",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    )
    settings = Settings(
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="test-service-role",
        gcp_vision_credentials_json=credentials_json,
        gemini_api_key="test-gemini-key",
        ai_service_token="test-service-token",
    )
    mock_response = MagicMock()

    with (
        patch("app.clients.vision_client.service_account.Credentials.from_service_account_info"),
        patch("app.clients.vision_client.vision.ImageAnnotatorClient") as client_cls,
    ):
        client_instance = MagicMock()
        client_instance.document_text_detection.return_value = mock_response
        client_cls.return_value = client_instance
        client = VisionClient(settings)

        result = client.detect_text(b"image-bytes")

    client_instance.document_text_detection.assert_called_once()
    request = client_instance.document_text_detection.call_args.kwargs["image"]
    assert request.content == b"image-bytes"
    assert result is mock_response
