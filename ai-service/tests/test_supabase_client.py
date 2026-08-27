"""Tests for Supabase service-role client."""

from __future__ import annotations

import json
from datetime import date
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest

from app.clients.supabase_client import SupabaseServiceClient, create_supabase_client
from app.core.config import Settings
from app.schemas.receipt import ParsedReceipt, ReceiptLineItem

HOUSEHOLD_ID = UUID("11111111-1111-1111-1111-111111111111")
RECEIPT_ID = UUID("33333333-3333-3333-3333-333333333333")
ITEM_ID = UUID("22222222-2222-2222-2222-222222222222")


def _settings() -> Settings:
    return Settings()


def test_create_supabase_client_builds_service_role_client() -> None:
    with patch("app.clients.supabase_client.create_client") as create_client:
        create_client.return_value = MagicMock()
        client = create_supabase_client(_settings())

    create_client.assert_called_once_with(
        "https://test.supabase.co",
        "test-service-role",
    )
    assert isinstance(client, SupabaseServiceClient)


def test_download_storage_reads_receipts_bucket() -> None:
    sdk = MagicMock()
    bucket = MagicMock()
    bucket.download.return_value = b"image-bytes"
    sdk.storage.from_.return_value = bucket
    client = SupabaseServiceClient(sdk)

    result = client.download_storage("household/receipt.jpg")

    sdk.storage.from_.assert_called_once_with("receipts")
    bucket.download.assert_called_once_with("household/receipt.jpg")
    assert result == b"image-bytes"


def test_find_product_mapping_queries_household_and_raw_string() -> None:
    sdk = MagicMock()
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.maybe_single.return_value = chain
    chain.execute.return_value = MagicMock(
        data={
            "standardized_item_id": str(ITEM_ID),
            "inventory_items": {"standardized_name": "Organic Milk"},
        }
    )
    sdk.table.return_value = chain
    client = SupabaseServiceClient(sdk)

    result = client.find_product_mapping(HOUSEHOLD_ID, "ORG MILK")

    sdk.table.assert_called_once_with("product_mapping")
    chain.select.assert_called_once_with("*, inventory_items(standardized_name)")
    chain.eq.assert_any_call("household_id", str(HOUSEHOLD_ID))
    chain.eq.assert_any_call("raw_ocr_string", "ORG MILK")
    assert result == {
        "standardized_item_id": str(ITEM_ID),
        "inventory_items": {"standardized_name": "Organic Milk"},
    }


def test_find_product_mapping_returns_none_when_execute_data_is_none() -> None:
    sdk = MagicMock()
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.maybe_single.return_value = chain
    chain.execute.return_value = MagicMock(data=None)
    sdk.table.return_value = chain
    client = SupabaseServiceClient(sdk)

    assert client.find_product_mapping(HOUSEHOLD_ID, "ORG MILK") is None


def test_update_pending_receipt_parsed_json_serializes_parsed_payload() -> None:
    sdk = MagicMock()
    chain = MagicMock()
    chain.update.return_value = chain
    chain.eq.return_value = chain
    chain.execute.return_value = MagicMock(data=[{"id": str(RECEIPT_ID)}])
    sdk.table.return_value = chain
    client = SupabaseServiceClient(sdk)
    parsed = ParsedReceipt(
        store_name="Test Store",
        date_purchased=date(2026, 8, 27),
        line_items=[
            ReceiptLineItem(
                raw_text="ORG MILK",
                standardized_name="Organic Milk",
                quantity=1.0,
                unit_price=0.0,
                total_price=0.0,
                matched_item_id=ITEM_ID,
                matched_via="lookup",
            )
        ],
    )

    client.update_pending_receipt_parsed_json(RECEIPT_ID, parsed)

    sdk.table.assert_called_once_with("pending_receipt")
    update_payload = chain.update.call_args[0][0]
    assert update_payload["parsed_json"] == json.loads(parsed.model_dump_json())
    chain.eq.assert_called_once_with("id", str(RECEIPT_ID))
    chain.execute.assert_called_once()


def test_find_inventory_item_by_name_queries_inventory_table() -> None:
    sdk = MagicMock()
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.maybe_single.return_value = chain
    chain.execute.return_value = MagicMock(data={"id": str(ITEM_ID)})
    sdk.table.return_value = chain
    client = SupabaseServiceClient(sdk)

    result = client.find_inventory_item_by_name(HOUSEHOLD_ID, "Organic Milk")

    sdk.table.assert_called_with("inventory_items")
    assert result == {"id": str(ITEM_ID)}


def test_create_inventory_item_inserts_and_returns_id() -> None:
    sdk = MagicMock()
    chain = MagicMock()
    chain.insert.return_value = chain
    chain.select.return_value = chain
    chain.single.return_value = chain
    chain.execute.return_value = MagicMock(data={"id": str(ITEM_ID)})
    sdk.table.return_value = chain
    client = SupabaseServiceClient(sdk)
    from app.schemas.receipt import GeminiLineExtraction

    extracted = GeminiLineExtraction(
        standardized_name="Organic Milk",
        quantity=1.0,
        unit_price=3.0,
        total_price=3.0,
        unit_type="gallon",
    )

    result = client.create_inventory_item(HOUSEHOLD_ID, extracted)

    assert result == ITEM_ID


def test_create_inventory_item_raises_when_insert_returns_invalid_id() -> None:
    sdk = MagicMock()
    chain = MagicMock()
    chain.insert.return_value = chain
    chain.select.return_value = chain
    chain.single.return_value = chain
    chain.execute.return_value = MagicMock(data={"id": 123})
    sdk.table.return_value = chain
    client = SupabaseServiceClient(sdk)
    from app.schemas.receipt import GeminiLineExtraction

    extracted = GeminiLineExtraction(
        standardized_name="Organic Milk",
        quantity=1.0,
        unit_price=3.0,
        total_price=3.0,
    )

    with pytest.raises(ValueError, match="missing id"):
        client.create_inventory_item(HOUSEHOLD_ID, extracted)


def test_insert_product_mapping_inserts_normalized_mapping() -> None:
    sdk = MagicMock()
    chain = MagicMock()
    chain.insert.return_value = chain
    chain.execute.return_value = MagicMock(data=[{}])
    sdk.table.return_value = chain
    client = SupabaseServiceClient(sdk)

    client.insert_product_mapping(HOUSEHOLD_ID, "ORG MILK", ITEM_ID)

    payload = chain.insert.call_args[0][0]
    assert payload["raw_ocr_string"] == "ORG MILK"
    assert payload["standardized_item_id"] == str(ITEM_ID)


def test_get_pending_receipt_returns_row() -> None:
    sdk = MagicMock()
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.maybe_single.return_value = chain
    chain.execute.return_value = MagicMock(data={"id": str(RECEIPT_ID), "status": "PENDING"})
    sdk.table.return_value = chain
    client = SupabaseServiceClient(sdk)

    result = client.get_pending_receipt(RECEIPT_ID)

    assert result == {"id": str(RECEIPT_ID), "status": "PENDING"}


def test_increment_inventory_quantity_updates_quantity() -> None:
    sdk = MagicMock()
    select_chain = MagicMock()
    select_chain.select.return_value = select_chain
    select_chain.eq.return_value = select_chain
    select_chain.single.return_value = select_chain
    select_chain.execute.return_value = MagicMock(data={"quantity": 5})

    update_chain = MagicMock()
    update_chain.update.return_value = update_chain
    update_chain.eq.return_value = update_chain
    update_chain.execute.return_value = MagicMock(data=[{}])

    sdk.table.side_effect = [select_chain, update_chain]
    client = SupabaseServiceClient(sdk)

    client.increment_inventory_quantity(ITEM_ID, 2.0)

    update_chain.update.assert_called_once_with({"quantity": 7.0})


def test_insert_price_history_inserts_row() -> None:
    sdk = MagicMock()
    chain = MagicMock()
    chain.insert.return_value = chain
    chain.execute.return_value = MagicMock(data=[{}])
    sdk.table.return_value = chain
    client = SupabaseServiceClient(sdk)

    client.insert_price_history(
        HOUSEHOLD_ID,
        ITEM_ID,
        3.5,
        "Test Store",
        date(2026, 8, 27),
    )

    payload = chain.insert.call_args[0][0]
    assert payload["price"] == 3.5
    assert payload["store_name"] == "Test Store"


def test_find_open_or_partial_to_buy_returns_entries() -> None:
    sdk = MagicMock()
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.in_.return_value = chain
    chain.order.return_value = chain
    chain.execute.return_value = MagicMock(
        data=[{"id": "entry-1", "quantity_requested": 3, "quantity_remaining": 3}]
    )
    sdk.table.return_value = chain
    client = SupabaseServiceClient(sdk)

    result = client.find_open_or_partial_to_buy(HOUSEHOLD_ID, ITEM_ID)

    assert len(result) == 1
    chain.in_.assert_called_once_with("status", ["OPEN", "PARTIAL"])


def test_find_open_or_partial_to_buy_returns_empty_list_for_non_list_data() -> None:
    sdk = MagicMock()
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.in_.return_value = chain
    chain.order.return_value = chain
    chain.execute.return_value = MagicMock(data=None)
    sdk.table.return_value = chain
    client = SupabaseServiceClient(sdk)

    assert client.find_open_or_partial_to_buy(HOUSEHOLD_ID, ITEM_ID) == []


def test_update_to_buy_remaining_updates_row() -> None:
    sdk = MagicMock()
    chain = MagicMock()
    chain.update.return_value = chain
    chain.eq.return_value = chain
    chain.execute.return_value = MagicMock(data=[{}])
    sdk.table.return_value = chain
    client = SupabaseServiceClient(sdk)
    entry_id = UUID("55555555-5555-5555-5555-555555555555")

    client.update_to_buy_remaining(entry_id, 2.0, "PARTIAL")

    chain.update.assert_called_once_with({"quantity_remaining": 2.0, "status": "PARTIAL"})


def test_update_pending_receipt_status_updates_status() -> None:
    sdk = MagicMock()
    chain = MagicMock()
    chain.update.return_value = chain
    chain.eq.return_value = chain
    chain.execute.return_value = MagicMock(data=[{}])
    sdk.table.return_value = chain
    client = SupabaseServiceClient(sdk)

    client.update_pending_receipt_status(RECEIPT_ID, "APPROVED")

    chain.update.assert_called_once_with({"status": "APPROVED"})
