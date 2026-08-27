"use client";

import { useEffect, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/client";

export type RealtimeChangePayload<T> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T | null;
  old: T | null;
};

type PostgresRealtimePayload<T> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T;
  old: T;
};

export function useRealtimeSubscription<T>(
  channelName: string,
  table: string,
  householdId: string,
  initial: T[],
  applyEvent: (current: T[], payload: RealtimeChangePayload<T>) => T[]
): T[] {
  const [items, setItems] = useState(initial);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  useEffect(() => {
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const realtimePayload = payload as unknown as PostgresRealtimePayload<T>;
          setItems((current) =>
            applyEvent(current, {
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
  }, [channelName, table, householdId, applyEvent]);

  return items;
}
