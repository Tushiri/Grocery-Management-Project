"use server";

import { autoToBuyQuantity, shouldCreateAutoToBuyEntry } from "@/lib/inventory/auto-to-buy";
import { getHouseholdIdForUser } from "@/lib/household/get-household-id";
import { supabaseServer } from "@/lib/supabase/server";
import type { InventoryItem, PriorityLevel } from "@/lib/types/database.types";

export type InventoryActionResult = { error?: string };

async function maybeCreateAutoToBuyEntry(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  item: InventoryItem
): Promise<void> {
  if (!shouldCreateAutoToBuyEntry(item)) {
    return;
  }

  const { data: existing } = await supabase
    .from("to_buy_list")
    .select("id")
    .eq("item_id", item.id)
    .in("status", ["OPEN", "PARTIAL"])
    .limit(1)
    .maybeSingle();

  if (existing) {
    return;
  }

  const quantityRequested = autoToBuyQuantity(item);
  await supabase.from("to_buy_list").insert({
    household_id: item.household_id,
    item_id: item.id,
    quantity_requested: quantityRequested,
    quantity_remaining: quantityRequested,
    status: "OPEN",
  });
}

export async function createInventoryItem(formData: FormData): Promise<InventoryActionResult> {
  try {
    const householdId = await getHouseholdIdForUser();
    const standardizedName = String(formData.get("standardized_name") ?? "").trim();
    const unitType = String(formData.get("unit_type") ?? "").trim();
    const quantity = Number(formData.get("quantity") ?? 0);
    const minThreshold = Number(formData.get("min_threshold") ?? 0);
    const priorityTag = String(formData.get("priority_tag") ?? "MEDIUM") as PriorityLevel;
    const category = String(formData.get("category") ?? "").trim();

    if (!standardizedName || !unitType) {
      return { error: "Name and unit are required." };
    }

    if (Number.isNaN(quantity) || quantity < 0) {
      return { error: "Quantity must be zero or greater." };
    }

    if (Number.isNaN(minThreshold) || minThreshold < 0) {
      return { error: "Minimum threshold must be zero or greater." };
    }

    const supabase = await supabaseServer();
    const { data: item, error } = await supabase
      .from("inventory_items")
      .insert({
        household_id: householdId,
        standardized_name: standardizedName,
        unit_type: unitType,
        quantity,
        min_threshold: minThreshold,
        priority_tag: priorityTag,
        category: category || null,
      })
      .select("*")
      .single();

    if (error || !item) {
      return { error: error?.message ?? "Could not create inventory item." };
    }

    await maybeCreateAutoToBuyEntry(supabase, item);
    return {};
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "Could not create inventory item." };
  }
}

export async function depleteInventoryItem(
  itemId: string,
  amount = 1
): Promise<InventoryActionResult> {
  try {
    if (!itemId) {
      return { error: "Item id is required." };
    }

    if (amount <= 0) {
      return { error: "Deplete amount must be greater than zero." };
    }

    const supabase = await supabaseServer();
    const { data: item, error: fetchError } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("id", itemId)
      .single();

    if (fetchError || !item) {
      return { error: fetchError?.message ?? "Inventory item not found." };
    }

    const nextQuantity = Math.max(0, Number(item.quantity) - amount);
    const { data: updated, error: updateError } = await supabase
      .from("inventory_items")
      .update({ quantity: nextQuantity })
      .eq("id", itemId)
      .select("*")
      .single();

    if (updateError || !updated) {
      return { error: updateError?.message ?? "Could not update inventory item." };
    }

    await maybeCreateAutoToBuyEntry(supabase, updated);
    return {};
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : "Could not deplete inventory item." };
  }
}
