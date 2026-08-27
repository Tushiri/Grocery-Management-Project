"""Tests for receipt approval reconciliation workflow."""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock
from uuid import UUID

import pytest

from app.schemas.receipt import ApproveReceiptRequest, ReceiptLineItem
from app.services.reconciliation_service import (
    _to_buy_status,
    apply_line_item,
    approve_receipt,
    reject_receipt,
)

HOUSEHOLD_ID = UUID("11111111-1111-1111-1111-111111111111")
RECEIPT_ID = UUID("33333333-3333-3333-3333-333333333333")
ITEM_ID = UUID("22222222-2222-2222-2222-222222222222")
TO_BUY_ID = UUID("55555555-5555-5555-5555-555555555555")


def _line(quantity: float) -> ReceiptLineItem:
    return ReceiptLineItem(
        raw_text="ORG MILK",
        standardized_name="Organic Milk",
        quantity=quantity,
        unit_price=3.5,
        total_price=quantity * 3.5,
        matched_item_id=ITEM_ID,
        matched_via="lookup",
    )


def test_apply_line_item_partial_to_buy_fulfillment() -> None:
    supabase = MagicMock()
    supabase.find_open_or_partial_to_buy.return_value = [
        {
            "id": str(TO_BUY_ID),
            "quantity_requested": 3,
            "quantity_remaining": 3,
            "status": "OPEN",
        }
    ]

    apply_line_item(
        _line(1.0),
        household_id=HOUSEHOLD_ID,
        store_name="Test Store",
        date_purchased=date(2026, 8, 27),
        supabase=supabase,
    )

    supabase.increment_inventory_quantity.assert_called_once_with(ITEM_ID, 1.0)
    supabase.insert_price_history.assert_called_once_with(
        HOUSEHOLD_ID,
        ITEM_ID,
        3.5,
        "Test Store",
        date(2026, 8, 27),
    )
    supabase.update_to_buy_remaining.assert_called_once_with(TO_BUY_ID, 2.0, "PARTIAL")
    supabase.delete = MagicMock()


def test_apply_line_item_fulfills_remaining_to_buy_quantity() -> None:
    supabase = MagicMock()
    supabase.find_open_or_partial_to_buy.return_value = [
        {
            "id": str(TO_BUY_ID),
            "quantity_requested": 3,
            "quantity_remaining": 2,
            "status": "PARTIAL",
        }
    ]

    apply_line_item(
        _line(2.0),
        household_id=HOUSEHOLD_ID,
        store_name="Test Store",
        date_purchased=date(2026, 8, 27),
        supabase=supabase,
    )

    supabase.update_to_buy_remaining.assert_called_once_with(TO_BUY_ID, 0.0, "FULFILLED")


def test_apply_line_item_without_to_buy_entries_updates_inventory_only() -> None:
    supabase = MagicMock()
    supabase.find_open_or_partial_to_buy.return_value = []

    apply_line_item(
        _line(1.0),
        household_id=HOUSEHOLD_ID,
        store_name="Test Store",
        date_purchased=date(2026, 8, 27),
        supabase=supabase,
    )

    supabase.increment_inventory_quantity.assert_called_once()
    supabase.insert_price_history.assert_called_once()
    supabase.update_to_buy_remaining.assert_not_called()


def test_apply_line_item_skips_when_matched_item_id_is_missing() -> None:
    supabase = MagicMock()
    line = _line(1.0).model_copy(update={"matched_item_id": None})

    apply_line_item(
        line,
        household_id=HOUSEHOLD_ID,
        store_name="Test Store",
        date_purchased=date(2026, 8, 27),
        supabase=supabase,
    )

    supabase.increment_inventory_quantity.assert_not_called()


def test_apply_line_item_consumes_multiple_to_buy_entries_in_order() -> None:
    supabase = MagicMock()
    second_entry = UUID("66666666-6666-6666-6666-666666666666")
    supabase.find_open_or_partial_to_buy.return_value = [
        {
            "id": str(TO_BUY_ID),
            "quantity_requested": 1,
            "quantity_remaining": 1,
            "status": "OPEN",
        },
        {
            "id": str(second_entry),
            "quantity_requested": 2,
            "quantity_remaining": 2,
            "status": "OPEN",
        },
    ]

    apply_line_item(
        _line(2.5),
        household_id=HOUSEHOLD_ID,
        store_name="Test Store",
        date_purchased=date(2026, 8, 27),
        supabase=supabase,
    )

    assert supabase.update_to_buy_remaining.call_count == 2
    supabase.update_to_buy_remaining.assert_any_call(TO_BUY_ID, 0.0, "FULFILLED")
    supabase.update_to_buy_remaining.assert_any_call(second_entry, 0.5, "PARTIAL")


def test_apply_line_item_skips_malformed_to_buy_rows() -> None:
    supabase = MagicMock()
    supabase.find_open_or_partial_to_buy.return_value = [
        {"id": 123, "quantity_requested": 3, "quantity_remaining": 3},
        {
            "id": str(TO_BUY_ID),
            "quantity_requested": 3,
            "quantity_remaining": 3,
            "status": "OPEN",
        },
    ]

    apply_line_item(
        _line(1.0),
        household_id=HOUSEHOLD_ID,
        store_name="Test Store",
        date_purchased=date(2026, 8, 27),
        supabase=supabase,
    )

    supabase.update_to_buy_remaining.assert_called_once_with(TO_BUY_ID, 2.0, "PARTIAL")


@pytest.mark.asyncio
async def test_approve_receipt_applies_lines_and_marks_receipt_approved() -> None:
    supabase = MagicMock()
    supabase.get_pending_receipt.return_value = {
        "id": str(RECEIPT_ID),
        "household_id": str(HOUSEHOLD_ID),
        "status": "PENDING",
        "store_name": "Test Store",
        "parsed_json": {"store_name": "Test Store", "date_purchased": "2026-08-27"},
    }
    supabase.find_open_or_partial_to_buy.return_value = []

    response = await approve_receipt(
        RECEIPT_ID,
        ApproveReceiptRequest(line_items=[_line(1.0)]),
        supabase=supabase,
    )

    assert response.status == "APPROVED"
    supabase.update_pending_receipt_status.assert_called_once_with(RECEIPT_ID, "APPROVED")


@pytest.mark.asyncio
async def test_approve_receipt_raises_when_receipt_not_pending() -> None:
    supabase = MagicMock()
    supabase.get_pending_receipt.return_value = {
        "id": str(RECEIPT_ID),
        "household_id": str(HOUSEHOLD_ID),
        "status": "APPROVED",
    }

    with pytest.raises(ValueError, match="not pending"):
        await approve_receipt(
            RECEIPT_ID,
            ApproveReceiptRequest(line_items=[_line(1.0)]),
            supabase=supabase,
        )


@pytest.mark.asyncio
async def test_approve_receipt_raises_when_receipt_missing() -> None:
    supabase = MagicMock()
    supabase.get_pending_receipt.return_value = None

    with pytest.raises(ValueError, match="not found"):
        await approve_receipt(
            RECEIPT_ID,
            ApproveReceiptRequest(line_items=[_line(1.0)]),
            supabase=supabase,
        )


@pytest.mark.asyncio
async def test_reject_receipt_updates_status_without_inventory_mutations() -> None:
    supabase = MagicMock()
    supabase.get_pending_receipt.return_value = {
        "id": str(RECEIPT_ID),
        "status": "PENDING",
    }

    response = await reject_receipt(RECEIPT_ID, supabase=supabase)

    assert response.status == "REJECTED"
    supabase.update_pending_receipt_status.assert_called_once_with(RECEIPT_ID, "REJECTED")
    supabase.increment_inventory_quantity.assert_not_called()


@pytest.mark.asyncio
async def test_approve_receipt_raises_when_household_id_missing() -> None:
    supabase = MagicMock()
    supabase.get_pending_receipt.return_value = {
        "id": str(RECEIPT_ID),
        "status": "PENDING",
    }

    with pytest.raises(ValueError, match="household_id"):
        await approve_receipt(
            RECEIPT_ID,
            ApproveReceiptRequest(line_items=[_line(1.0)]),
            supabase=supabase,
        )


@pytest.mark.asyncio
async def test_reject_receipt_raises_when_receipt_missing() -> None:
    supabase = MagicMock()
    supabase.get_pending_receipt.return_value = None

    with pytest.raises(ValueError, match="not found"):
        await reject_receipt(RECEIPT_ID, supabase=supabase)


def test_to_buy_status_open_when_remaining_equals_requested() -> None:
    assert _to_buy_status(3.0, 3.0) == "OPEN"


def test_apply_line_item_breaks_when_line_quantity_is_fully_allocated() -> None:
    supabase = MagicMock()
    second_entry = UUID("66666666-6666-6666-6666-666666666666")
    supabase.find_open_or_partial_to_buy.return_value = [
        {
            "id": str(TO_BUY_ID),
            "quantity_requested": 1,
            "quantity_remaining": 1,
            "status": "OPEN",
        },
        {
            "id": str(second_entry),
            "quantity_requested": 2,
            "quantity_remaining": 2,
            "status": "OPEN",
        },
    ]

    apply_line_item(
        _line(1.0),
        household_id=HOUSEHOLD_ID,
        store_name="Test Store",
        date_purchased=date(2026, 8, 27),
        supabase=supabase,
    )

    supabase.update_to_buy_remaining.assert_called_once()


def test_apply_line_item_skips_entries_with_invalid_quantity_fields() -> None:
    supabase = MagicMock()
    supabase.find_open_or_partial_to_buy.return_value = [
        {
            "id": str(TO_BUY_ID),
            "quantity_requested": "bad",
            "quantity_remaining": 3,
        }
    ]

    apply_line_item(
        _line(1.0),
        household_id=HOUSEHOLD_ID,
        store_name="Test Store",
        date_purchased=date(2026, 8, 27),
        supabase=supabase,
    )

    supabase.update_to_buy_remaining.assert_not_called()


@pytest.mark.asyncio
async def test_approve_receipt_resolves_store_name_from_parsed_json() -> None:
    supabase = MagicMock()
    supabase.get_pending_receipt.return_value = {
        "id": str(RECEIPT_ID),
        "household_id": str(HOUSEHOLD_ID),
        "status": "PENDING",
        "store_name": "",
        "parsed_json": {"store_name": "Parsed Store", "date_purchased": "2026-08-27"},
    }
    supabase.find_open_or_partial_to_buy.return_value = []

    await approve_receipt(
        RECEIPT_ID,
        ApproveReceiptRequest(line_items=[_line(1.0)]),
        supabase=supabase,
    )

    supabase.insert_price_history.assert_called_once()
    assert supabase.insert_price_history.call_args[0][3] == "Parsed Store"


@pytest.mark.asyncio
async def test_approve_receipt_defaults_metadata_when_parsed_json_missing() -> None:
    supabase = MagicMock()
    supabase.get_pending_receipt.return_value = {
        "id": str(RECEIPT_ID),
        "household_id": str(HOUSEHOLD_ID),
        "status": "PENDING",
        "store_name": None,
        "parsed_json": None,
    }
    supabase.find_open_or_partial_to_buy.return_value = []

    await approve_receipt(
        RECEIPT_ID,
        ApproveReceiptRequest(line_items=[_line(1.0)]),
        supabase=supabase,
    )

    supabase.insert_price_history.assert_called_once_with(
        HOUSEHOLD_ID,
        ITEM_ID,
        3.5,
        "",
        date.today(),
    )


@pytest.mark.asyncio
async def test_approve_receipt_uses_today_when_parsed_date_is_not_string() -> None:
    supabase = MagicMock()
    supabase.get_pending_receipt.return_value = {
        "id": str(RECEIPT_ID),
        "household_id": str(HOUSEHOLD_ID),
        "status": "PENDING",
        "store_name": "Test Store",
        "parsed_json": {"date_purchased": 20260827},
    }
    supabase.find_open_or_partial_to_buy.return_value = []

    await approve_receipt(
        RECEIPT_ID,
        ApproveReceiptRequest(line_items=[_line(1.0)]),
        supabase=supabase,
    )

    supabase.insert_price_history.assert_called_once_with(
        HOUSEHOLD_ID,
        ITEM_ID,
        3.5,
        "Test Store",
        date.today(),
    )
