"use client";

import { useEffect, useState } from "react";

import { applyInventoryRealtimeEvent } from "@/lib/inventory/apply-realtime-event";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { InventoryItem } from "@/lib/types/database.types";

type RealtimePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: InventoryItem;
  old: InventoryItem;
};

export function useRealtimeInventory(householdId: string, initialItems: InventoryItem[]) {
  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`inventory:${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_items",
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const realtimePayload = payload as unknown as RealtimePayload;
          setItems((current) =>
            applyInventoryRealtimeEvent(current, {
              eventType: realtimePayload.eventType,
              new: realtimePayload.new ?? null,
              old: realtimePayload.old ?? null,
            })
          );
        }
      )
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [householdId]);

  return items;
}
