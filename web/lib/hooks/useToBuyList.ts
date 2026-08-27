"use client";

import { useEffect, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { applyToBuyRealtimeEvent } from "@/lib/to-buy/apply-realtime-event";
import type { ToBuyListEntryWithItem } from "@/lib/types/database.types";

type RealtimePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: ToBuyListEntryWithItem;
  old: ToBuyListEntryWithItem;
};

export function useToBuyList(householdId: string, initialEntries: ToBuyListEntryWithItem[]) {
  const [entries, setEntries] = useState(initialEntries);

  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  useEffect(() => {
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`to-buy:${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "to_buy_list",
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const realtimePayload = payload as unknown as RealtimePayload;
          setEntries((current) =>
            applyToBuyRealtimeEvent(current, {
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

  return entries;
}
