import type { InventoryItem } from "@/lib/types/database.types";

export type InventoryRealtimeEvent = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: InventoryItem | null;
  old: InventoryItem | null;
};

/** Pure handler for Supabase Realtime `postgres_changes` on `inventory_items`. */
export function applyInventoryRealtimeEvent(
  items: InventoryItem[],
  event: InventoryRealtimeEvent
): InventoryItem[] {
  switch (event.eventType) {
    case "INSERT":
      if (!event.new || items.some((item) => item.id === event.new?.id)) {
        return items;
      }
      return [...items, event.new];
    case "UPDATE":
      if (!event.new) {
        return items;
      }
      return items.map((item) => (item.id === event.new?.id ? event.new : item));
    case "DELETE":
      if (!event.old) {
        return items;
      }
      return items.filter((item) => item.id !== event.old?.id);
    default:
      return items;
  }
}
