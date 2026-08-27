"use server";

import { getHouseholdIdForUser } from "@/lib/household/get-household-id";
import { supabaseServer } from "@/lib/supabase/server";

export type ToBuyActionResult = { error?: string };

export async function addToBuyListEntry(formData: FormData): Promise<ToBuyActionResult> {
  try {
    const householdId = await getHouseholdIdForUser();
    const itemId = String(formData.get("item_id") ?? "").trim();
    const quantityRequested = Number(formData.get("quantity_requested") ?? 0);

    if (!itemId) {
      return { error: "Inventory item is required." };
    }

    if (Number.isNaN(quantityRequested) || quantityRequested <= 0) {
      return { error: "Quantity must be greater than zero." };
    }

    const supabase = await supabaseServer();
    const { data: item, error: itemError } = await supabase
      .from("inventory_items")
      .select("id")
      .eq("id", itemId)
      .eq("household_id", householdId)
      .maybeSingle();

    if (itemError || !item) {
      return { error: "Inventory item not found in your household." };
    }

    const { error } = await supabase.from("to_buy_list").insert({
      household_id: householdId,
      item_id: itemId,
      quantity_requested: quantityRequested,
      quantity_remaining: quantityRequested,
      status: "OPEN",
    });

    if (error) {
      return { error: error.message };
    }

    return {};
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "Could not add to-buy entry." };
  }
}
