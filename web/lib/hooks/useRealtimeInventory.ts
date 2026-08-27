"use client";

import { useCallback } from "react";

import { applyInventoryRealtimeEvent } from "@/lib/inventory/apply-realtime-event";
import { useRealtimeSubscription } from "@/lib/hooks/useRealtimeSubscription";
import type { InventoryItem } from "@/lib/types/database.types";

export function useRealtimeInventory(householdId: string, initialItems: InventoryItem[]) {
  const applyEvent = useCallback(
    (current: InventoryItem[], payload: Parameters<typeof applyInventoryRealtimeEvent>[1]) =>
      applyInventoryRealtimeEvent(current, payload),
    []
  );

  return useRealtimeSubscription(
    `inventory:${householdId}`,
    "inventory_items",
    householdId,
    initialItems,
    applyEvent
  );
}
