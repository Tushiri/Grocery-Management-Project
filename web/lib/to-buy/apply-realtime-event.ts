import type { ToBuyListEntryWithItem } from "@/lib/types/database.types";
import type { ToBuyStatus } from "@/lib/types/database.types";

export type ToBuyRealtimeEvent = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: ToBuyListEntryWithItem | null;
  old: ToBuyListEntryWithItem | null;
};

/** Pure handler for Supabase Realtime `postgres_changes` on `to_buy_list`. */
export function applyToBuyRealtimeEvent(
  entries: ToBuyListEntryWithItem[],
  event: ToBuyRealtimeEvent
): ToBuyListEntryWithItem[] {
  switch (event.eventType) {
    case "INSERT":
      if (!event.new || entries.some((entry) => entry.id === event.new?.id)) {
        return entries;
      }
      return [...entries, event.new];
    case "UPDATE":
      if (!event.new) {
        return entries;
      }
      return entries.map((entry) => (entry.id === event.new?.id ? event.new : entry));
    case "DELETE":
      if (!event.old) {
        return entries;
      }
      return entries.filter((entry) => entry.id !== event.old?.id);
    default:
      return entries;
  }
}

/** Client-side status filter for the to-buy list UI. */
export function filterToBuyByStatus(
  entries: ToBuyListEntryWithItem[],
  status: ToBuyStatus | "ALL"
): ToBuyListEntryWithItem[] {
  if (status === "ALL") {
    return entries;
  }
  return entries.filter((entry) => entry.status === status);
}
