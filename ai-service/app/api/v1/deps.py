"""FastAPI dependencies for receipt processing."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.clients.gemini_client import GeminiClient
from app.clients.supabase_client import SupabaseServiceClient, create_supabase_client
from app.clients.vision_client import VisionClient
from app.core.config import Settings, get_settings
from app.services.gemini_service import GeminiService
from app.services.ocr_service import OcrService
from app.services.product_mapping_service import ProductMappingService


def get_supabase_service_client(
    settings: Annotated[Settings, Depends(get_settings)],
) -> SupabaseServiceClient:
    return create_supabase_client(settings)


def get_ocr_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> OcrService:
    return OcrService(VisionClient(settings))


def get_gemini_service(
    settings: Annotated[Settings, Depends(get_settings)],
) -> GeminiService:
    return GeminiService(GeminiClient(settings))


def get_product_mapping_service(
    supabase: Annotated[SupabaseServiceClient, Depends(get_supabase_service_client)],
) -> ProductMappingService:
    return ProductMappingService(supabase)
