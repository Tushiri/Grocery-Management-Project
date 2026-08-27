"""Tests for OCR string normalization and product mapping lookup."""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import UUID

import pytest

from app.core.text_utils import normalize_ocr_string
from app.services.product_mapping_service import ProductMappingMatch, ProductMappingService

HOUSEHOLD_ID = UUID("11111111-1111-1111-1111-111111111111")
ITEM_ID = UUID("22222222-2222-2222-2222-222222222222")


def test_normalize_ocr_string_trims_uppercases_and_collapses_whitespace() -> None:
    assert normalize_ocr_string("  Org Milk  ") == "ORG MILK"
    assert normalize_ocr_string("ORG   MILK") == "ORG MILK"


def test_find_exact_match_applies_normalization_before_query() -> None:
    supabase = MagicMock()
    supabase.find_product_mapping.return_value = {
        "standardized_item_id": str(ITEM_ID),
        "inventory_items": {"standardized_name": "Organic Milk"},
    }
    service = ProductMappingService(supabase)

    match = service.find_exact_match(HOUSEHOLD_ID, "  org   milk  ")

    supabase.find_product_mapping.assert_called_once_with(HOUSEHOLD_ID, "ORG MILK")
    assert match == ProductMappingMatch(
        standardized_item_id=ITEM_ID,
        standardized_name="Organic Milk",
        raw_ocr_string="ORG MILK",
    )


def test_find_exact_match_returns_none_when_no_mapping_exists() -> None:
    supabase = MagicMock()
    supabase.find_product_mapping.return_value = None
    service = ProductMappingService(supabase)

    match = service.find_exact_match(HOUSEHOLD_ID, "UNKNOWN ITEM")

    assert match is None


def test_find_exact_match_returns_none_when_inventory_join_missing() -> None:
    supabase = MagicMock()
    supabase.find_product_mapping.return_value = {
        "standardized_item_id": str(ITEM_ID),
        "inventory_items": None,
    }
    service = ProductMappingService(supabase)

    match = service.find_exact_match(HOUSEHOLD_ID, "ORG MILK")

    assert match is None


def test_find_exact_match_returns_none_when_item_id_is_invalid() -> None:
    supabase = MagicMock()
    supabase.find_product_mapping.return_value = {
        "standardized_item_id": 123,
        "inventory_items": {"standardized_name": "Organic Milk"},
    }
    service = ProductMappingService(supabase)

    match = service.find_exact_match(HOUSEHOLD_ID, "ORG MILK")

    assert match is None


def test_find_exact_match_returns_none_when_standardized_name_is_invalid() -> None:
    supabase = MagicMock()
    supabase.find_product_mapping.return_value = {
        "standardized_item_id": str(ITEM_ID),
        "inventory_items": {"standardized_name": 123},
    }
    service = ProductMappingService(supabase)

    match = service.find_exact_match(HOUSEHOLD_ID, "ORG MILK")

    assert match is None


def test_resolve_or_create_item_reuses_existing_inventory_row() -> None:
    from app.schemas.receipt import GeminiLineExtraction

    supabase = MagicMock()
    supabase.find_inventory_item_by_name.return_value = {"id": str(ITEM_ID)}
    service = ProductMappingService(supabase)
    extracted = GeminiLineExtraction(
        standardized_name="Organic Milk",
        quantity=1.0,
        unit_price=3.0,
        total_price=3.0,
    )

    item_id = service.resolve_or_create_item(HOUSEHOLD_ID, extracted)

    assert item_id == ITEM_ID
    supabase.create_inventory_item.assert_not_called()


def test_resolve_or_create_item_creates_inventory_when_missing() -> None:
    from app.schemas.receipt import GeminiLineExtraction

    supabase = MagicMock()
    supabase.find_inventory_item_by_name.return_value = None
    supabase.create_inventory_item.return_value = ITEM_ID
    service = ProductMappingService(supabase)
    extracted = GeminiLineExtraction(
        standardized_name="New Item",
        quantity=1.0,
        unit_price=2.0,
        total_price=2.0,
    )

    item_id = service.resolve_or_create_item(HOUSEHOLD_ID, extracted)

    assert item_id == ITEM_ID
    supabase.create_inventory_item.assert_called_once_with(HOUSEHOLD_ID, extracted)


def test_persist_mapping_normalizes_raw_ocr_string() -> None:
    supabase = MagicMock()
    service = ProductMappingService(supabase)

    service.persist_mapping(HOUSEHOLD_ID, "  org   milk  ", ITEM_ID)

    supabase.insert_product_mapping.assert_called_once_with(HOUSEHOLD_ID, "ORG MILK", ITEM_ID)


def test_resolve_or_create_item_raises_when_existing_row_has_invalid_id() -> None:
    from app.domain.exceptions import InvalidInventoryDataError
    from app.schemas.receipt import GeminiLineExtraction

    supabase = MagicMock()
    supabase.find_inventory_item_by_name.return_value = {"id": 123}
    service = ProductMappingService(supabase)
    extracted = GeminiLineExtraction(
        standardized_name="Organic Milk",
        quantity=1.0,
        unit_price=3.0,
        total_price=3.0,
    )

    with pytest.raises(InvalidInventoryDataError, match="invalid id"):
        service.resolve_or_create_item(HOUSEHOLD_ID, extracted)

    supabase.create_inventory_item.assert_not_called()
