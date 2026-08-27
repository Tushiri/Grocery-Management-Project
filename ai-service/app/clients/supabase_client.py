"""Supabase client using the service role key for trusted backend processing."""

from __future__ import annotations

import json
from datetime import date
from typing import Any
from uuid import UUID

from supabase import Client, create_client

from app.core.config import Settings
from app.schemas.receipt import GeminiLineExtraction, ParsedReceipt

RECEIPTS_BUCKET = "receipts"


class SupabaseServiceClient:
    """Thin wrapper around supabase-py for storage and Postgres access."""

    def __init__(self, client: Client) -> None:
        self._client = client

    def download_storage(self, path: str) -> bytes:
        return self._client.storage.from_(RECEIPTS_BUCKET).download(path)

    def find_product_mapping(
        self,
        household_id: UUID,
        raw_ocr_string: str,
    ) -> dict[str, Any] | None:
        response = (
            self._client.table("product_mapping")
            .select("*, inventory_items(standardized_name)")
            .eq("household_id", str(household_id))
            .eq("raw_ocr_string", raw_ocr_string)
            .maybe_single()
            .execute()
        )
        data = response.data
        if data is None:
            return None
        return data

    def find_inventory_item_by_name(
        self,
        household_id: UUID,
        standardized_name: str,
    ) -> dict[str, Any] | None:
        response = (
            self._client.table("inventory_items")
            .select("id, standardized_name")
            .eq("household_id", str(household_id))
            .eq("standardized_name", standardized_name)
            .maybe_single()
            .execute()
        )
        return response.data

    def create_inventory_item(
        self,
        household_id: UUID,
        extracted: GeminiLineExtraction,
    ) -> UUID:
        response = (
            self._client.table("inventory_items")
            .insert(
                {
                    "household_id": str(household_id),
                    "standardized_name": extracted.standardized_name,
                    "quantity": 0,
                    "unit_type": extracted.unit_type,
                    "category": extracted.category,
                    "priority_tag": "MEDIUM",
                    "min_threshold": 0,
                }
            )
            .select("id")
            .single()
            .execute()
        )
        item_id = response.data["id"]
        if not isinstance(item_id, str):
            raise ValueError("Created inventory item missing id")
        return UUID(item_id)

    def insert_product_mapping(
        self,
        household_id: UUID,
        raw_ocr_string: str,
        item_id: UUID,
    ) -> None:
        (
            self._client.table("product_mapping")
            .upsert(
                {
                    "household_id": str(household_id),
                    "raw_ocr_string": raw_ocr_string,
                    "standardized_item_id": str(item_id),
                },
                on_conflict="household_id,raw_ocr_string",
            )
            .execute()
        )

    def update_pending_receipt_parsed_json(
        self,
        receipt_id: UUID,
        parsed: ParsedReceipt,
    ) -> None:
        (
            self._client.table("pending_receipt")
            .update({"parsed_json": json.loads(parsed.model_dump_json())})
            .eq("id", str(receipt_id))
            .execute()
        )

    def get_pending_receipt(self, receipt_id: UUID) -> dict[str, Any] | None:
        response = (
            self._client.table("pending_receipt")
            .select("*")
            .eq("id", str(receipt_id))
            .maybe_single()
            .execute()
        )
        return response.data

    def increment_inventory_quantity(self, item_id: UUID, amount: float) -> None:
        (
            self._client.rpc(
                "increment_inventory_quantity",
                {"p_item_id": str(item_id), "p_amount": amount},
            ).execute()
        )

    def insert_price_history(
        self,
        household_id: UUID,
        item_id: UUID,
        price: float,
        store_name: str,
        date_purchased: date,
    ) -> None:
        (
            self._client.table("price_history")
            .insert(
                {
                    "household_id": str(household_id),
                    "item_id": str(item_id),
                    "price": price,
                    "store_name": store_name,
                    "date_purchased": date_purchased.isoformat(),
                }
            )
            .execute()
        )

    def find_open_or_partial_to_buy(
        self,
        household_id: UUID,
        item_id: UUID,
    ) -> list[dict[str, Any]]:
        response = (
            self._client.table("to_buy_list")
            .select("id, quantity_requested, quantity_remaining, status")
            .eq("household_id", str(household_id))
            .eq("item_id", str(item_id))
            .in_("status", ["OPEN", "PARTIAL"])
            .order("created_at")
            .execute()
        )
        data = response.data
        if not isinstance(data, list):
            return []
        return data

    def update_to_buy_remaining(
        self,
        entry_id: UUID,
        quantity_remaining: float,
        status: str,
    ) -> None:
        (
            self._client.table("to_buy_list")
            .update({"quantity_remaining": quantity_remaining, "status": status})
            .eq("id", str(entry_id))
            .execute()
        )

    def update_pending_receipt_status(self, receipt_id: UUID, status: str) -> None:
        (
            self._client.table("pending_receipt")
            .update({"status": status})
            .eq("id", str(receipt_id))
            .execute()
        )


def create_supabase_client(settings: Settings) -> SupabaseServiceClient:
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return SupabaseServiceClient(client)
