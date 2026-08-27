"""Google Cloud Vision API client wrapper."""

from __future__ import annotations

import json
from typing import Any

from google.cloud import vision
from google.oauth2 import service_account

from app.core.config import Settings


class VisionClient:
    """Thin wrapper over document text detection."""

    def __init__(self, settings: Settings) -> None:
        credentials_info = json.loads(settings.gcp_vision_credentials_json)
        credentials = service_account.Credentials.from_service_account_info(credentials_info)
        self._client = vision.ImageAnnotatorClient(credentials=credentials)

    def detect_text(self, image_bytes: bytes) -> Any:
        image = vision.Image(content=image_bytes)
        return self._client.document_text_detection(image=image)
