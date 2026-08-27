"""Household-scoped product mapping lookup and persistence."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.clients.supabase_client import SupabaseServiceClient
from app.core.text_utils import normalize_ocr_string
from app.schemas.receipt import GeminiLineExtraction


@dataclass(frozen=True)
class ProductMappingMatch:
    standardized_item_id: UUID
    standardized_name: str
    raw_ocr_string: str


class ProductMappingService:
    """Lookup-first resolver for normalized OCR strings."""

    def __init__(self, repository: SupabaseServiceClient | Any) -> None:
        self._repository = repository

    def find_exact_match(
        self,
        household_id: UUID,
        raw_ocr_string: str,
    ) -> ProductMappingMatch | None:
        normalized = normalize_ocr_string(raw_ocr_string)
        row = self._repository.find_product_mapping(household_id, normalized)
        if row is None:
            return None

        inventory_items = row.get("inventory_items")
        if not isinstance(inventory_items, dict):
            return None

        standardized_name = inventory_items.get("standardized_name")
        item_id = row.get("standardized_item_id")
        if not isinstance(standardized_name, str) or not isinstance(item_id, str):
            return None

        return ProductMappingMatch(
            standardized_item_id=UUID(item_id),
            standardized_name=standardized_name,
            raw_ocr_string=normalized,
        )

    def resolve_or_create_item(
        self,
        household_id: UUID,
        extracted: GeminiLineExtraction,
    ) -> UUID:
        existing = self._repository.find_inventory_item_by_name(
            household_id,
            extracted.standardized_name,
        )
        if existing is not None:
            item_id = existing.get("id")
            if isinstance(item_id, str):
                return UUID(item_id)
        return self._repository.create_inventory_item(household_id, extracted)

    def persist_mapping(
        self,
        household_id: UUID,
        raw_ocr_string: str,
        item_id: UUID,
    ) -> None:
        normalized = normalize_ocr_string(raw_ocr_string)
        self._repository.insert_product_mapping(household_id, normalized, item_id)
