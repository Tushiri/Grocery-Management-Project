import { describe, expect, it } from "vitest";

import {
  applyInventoryRealtimeEvent,
  type InventoryRealtimeEvent,
} from "@/lib/inventory/apply-realtime-event";
import type { InventoryItem } from "@/lib/types/database.types";

const baseItem: InventoryItem = {
  id: "item-1",
  household_id: "household-1",
  standardized_name: "Milk",
  quantity: 2,
  unit_type: "L",
  category: null,
  priority_tag: "MEDIUM",
  min_threshold: 1,
  expiration_date: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("applyInventoryRealtimeEvent", () => {
  it("inserts a new item from an INSERT payload", () => {
    const result = applyInventoryRealtimeEvent([], {
      eventType: "INSERT",
      new: baseItem,
      old: null,
    });

    expect(result).toEqual([baseItem]);
  });

  it("ignores duplicate INSERT payloads", () => {
    const result = applyInventoryRealtimeEvent([baseItem], {
      eventType: "INSERT",
      new: baseItem,
      old: null,
    });

    expect(result).toEqual([baseItem]);
  });

  it("updates an item from an UPDATE payload", () => {
    const updated = { ...baseItem, quantity: 1 };
    const result = applyInventoryRealtimeEvent([baseItem], {
      eventType: "UPDATE",
      new: updated,
      old: baseItem,
    });

    expect(result[0]?.quantity).toBe(1);
  });

  it("removes an item from a DELETE payload", () => {
    const result = applyInventoryRealtimeEvent([baseItem], {
      eventType: "DELETE",
      new: null,
      old: baseItem,
    });

    expect(result).toEqual([]);
  });

  it("returns the original list when payload data is missing", () => {
    const events: InventoryRealtimeEvent[] = [
      { eventType: "INSERT", new: null, old: null },
      { eventType: "UPDATE", new: null, old: baseItem },
      { eventType: "DELETE", new: null, old: null },
    ];

    for (const event of events) {
      expect(applyInventoryRealtimeEvent([baseItem], event)).toEqual([baseItem]);
    }
  });

  it("returns the original list for unknown event types", () => {
    const result = applyInventoryRealtimeEvent([baseItem], {
      eventType: "UNKNOWN" as "INSERT",
      new: null,
      old: null,
    });

    expect(result).toEqual([baseItem]);
  });
});
