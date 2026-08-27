"""OCR line extraction via Google Cloud Vision."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.clients.vision_client import VisionClient


@dataclass(frozen=True)
class OcrLine:
    text: str


class OcrService:
    """Parses Vision API responses into ordered non-empty text lines."""

    def __init__(self, vision_client: VisionClient | Any) -> None:
        self._vision_client = vision_client

    def extract_lines(self, image_bytes: bytes) -> list[OcrLine]:
        response = self._vision_client.detect_text(image_bytes)
        annotations = getattr(response, "text_annotations", None)
        if not annotations:
            return []

        full_text = getattr(annotations[0], "description", "") or ""
        lines: list[OcrLine] = []
        for raw_line in full_text.splitlines():
            text = raw_line.strip()
            if text:
                lines.append(OcrLine(text=text))
        return lines
