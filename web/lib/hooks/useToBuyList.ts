"use client";

import { useCallback } from "react";

import { useRealtimeSubscription } from "@/lib/hooks/useRealtimeSubscription";
import { applyToBuyRealtimeEvent } from "@/lib/to-buy/apply-realtime-event";
import type { ToBuyListEntryWithItem } from "@/lib/types/database.types";

export function useToBuyList(householdId: string, initialEntries: ToBuyListEntryWithItem[]) {
  const applyEvent = useCallback(
    (current: ToBuyListEntryWithItem[], payload: Parameters<typeof applyToBuyRealtimeEvent>[1]) =>
      applyToBuyRealtimeEvent(current, payload),
    []
  );

  return useRealtimeSubscription(
    `to-buy:${householdId}`,
    "to_buy_list",
    householdId,
    initialEntries,
    applyEvent
  );
}
