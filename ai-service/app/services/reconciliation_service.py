"""Reconciliation engine for approved receipt line items."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from app.clients.supabase_client import SupabaseServiceClient
from app.schemas.receipt import (
    ApproveReceiptRequest,
    ApproveReceiptResponse,
    ReceiptLineItem,
    RejectReceiptResponse,
)


def _to_buy_status(quantity_requested: float, quantity_remaining: float) -> str:
    if quantity_remaining == 0:
        return "FULFILLED"
    if quantity_remaining < quantity_requested:
        return "PARTIAL"
    return "OPEN"


def apply_line_item(
    line: ReceiptLineItem,
    *,
    household_id: UUID,
    store_name: str,
    date_purchased: date,
    supabase: SupabaseServiceClient,
) -> None:
    if line.matched_item_id is None:
        return

    supabase.increment_inventory_quantity(line.matched_item_id, line.quantity)
    supabase.insert_price_history(
        household_id,
        line.matched_item_id,
        line.unit_price,
        store_name,
        date_purchased,
    )

    remaining_qty = line.quantity
    for entry in supabase.find_open_or_partial_to_buy(household_id, line.matched_item_id):
        if remaining_qty <= 0:
            break

        entry_id = entry.get("id")
        quantity_requested = entry.get("quantity_requested")
        quantity_remaining = entry.get("quantity_remaining")
        if not isinstance(entry_id, str):
            continue
        if not isinstance(quantity_requested, (int, float)) or not isinstance(
            quantity_remaining, (int, float)
        ):
            continue

        applied = min(float(quantity_remaining), remaining_qty)
        new_remaining = float(quantity_remaining) - applied
        new_status = _to_buy_status(float(quantity_requested), new_remaining)
        supabase.update_to_buy_remaining(UUID(entry_id), new_remaining, new_status)
        remaining_qty -= applied


def _resolve_receipt_metadata(
    pending: dict[str, object],
) -> tuple[str, date, UUID]:
    household_id = pending.get("household_id")
    if not isinstance(household_id, str):
        raise ValueError("Pending receipt missing household_id")

    store_name = pending.get("store_name")
    if not isinstance(store_name, str) or not store_name:
        parsed_json = pending.get("parsed_json")
        if isinstance(parsed_json, dict):
            parsed_store = parsed_json.get("store_name")
            store_name = parsed_store if isinstance(parsed_store, str) else ""
        else:
            store_name = ""

    parsed_json = pending.get("parsed_json")
    date_purchased = date.today()
    if isinstance(parsed_json, dict):
        parsed_date = parsed_json.get("date_purchased")
        if isinstance(parsed_date, str):
            date_purchased = date.fromisoformat(parsed_date)

    return store_name, date_purchased, UUID(household_id)


async def approve_receipt(
    pending_receipt_id: UUID,
    req: ApproveReceiptRequest,
    *,
    supabase: SupabaseServiceClient,
) -> ApproveReceiptResponse:
    pending = supabase.get_pending_receipt(pending_receipt_id)
    if pending is None:
        raise ValueError("Pending receipt not found")

    status = pending.get("status")
    if status != "PENDING":
        raise ValueError("Receipt is not pending approval")

    store_name, date_purchased, household_id = _resolve_receipt_metadata(pending)

    for line in req.line_items:
        apply_line_item(
            line,
            household_id=household_id,
            store_name=store_name,
            date_purchased=date_purchased,
            supabase=supabase,
        )

    supabase.update_pending_receipt_status(pending_receipt_id, "APPROVED")
    return ApproveReceiptResponse(pending_receipt_id=pending_receipt_id, status="APPROVED")


async def reject_receipt(
    pending_receipt_id: UUID,
    *,
    supabase: SupabaseServiceClient,
) -> RejectReceiptResponse:
    pending = supabase.get_pending_receipt(pending_receipt_id)
    if pending is None:
        raise ValueError("Pending receipt not found")

    supabase.update_pending_receipt_status(pending_receipt_id, "REJECTED")
    return RejectReceiptResponse(pending_receipt_id=pending_receipt_id, status="REJECTED")
