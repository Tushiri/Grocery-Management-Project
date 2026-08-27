import { describe, expect, it } from "vitest";

import {
  applyToBuyRealtimeEvent,
  filterToBuyByStatus,
} from "@/lib/to-buy/apply-realtime-event";
import type { ToBuyListEntryWithItem } from "@/lib/types/database.types";

const baseEntry: ToBuyListEntryWithItem = {
  id: "buy-1",
  household_id: "household-1",
  item_id: "item-1",
  quantity_requested: 3,
  quantity_remaining: 3,
  status: "OPEN",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  inventory_items: { standardized_name: "Milk", unit_type: "L" },
};

describe("applyToBuyRealtimeEvent", () => {
  it("inserts, updates, and deletes entries from realtime payloads", () => {
    const inserted = applyToBuyRealtimeEvent([], {
      eventType: "INSERT",
      new: baseEntry,
      old: null,
    });
    expect(inserted).toEqual([baseEntry]);

    const updatedEntry = { ...baseEntry, status: "PARTIAL" as const, quantity_remaining: 1 };
    const updated = applyToBuyRealtimeEvent(inserted, {
      eventType: "UPDATE",
      new: updatedEntry,
      old: baseEntry,
    });
    expect(updated[0]?.status).toBe("PARTIAL");

    const deleted = applyToBuyRealtimeEvent(updated, {
      eventType: "DELETE",
      new: null,
      old: updatedEntry,
    });
    expect(deleted).toEqual([]);
  });

  it("ignores duplicate INSERT payloads", () => {
    expect(
      applyToBuyRealtimeEvent([baseEntry], { eventType: "INSERT", new: baseEntry, old: null })
    ).toEqual([baseEntry]);
  });

  it("returns the original list for malformed UPDATE and DELETE payloads", () => {
    expect(
      applyToBuyRealtimeEvent([baseEntry], { eventType: "UPDATE", new: null, old: baseEntry })
    ).toEqual([baseEntry]);
    expect(
      applyToBuyRealtimeEvent([baseEntry], { eventType: "DELETE", new: null, old: null })
    ).toEqual([baseEntry]);
  });

  it("returns the original list for unknown event types", () => {
    expect(
      applyToBuyRealtimeEvent([baseEntry], {
        eventType: "UNKNOWN" as "INSERT",
        new: null,
        old: null,
      })
    ).toEqual([baseEntry]);
  });
});

describe("filterToBuyByStatus", () => {
  const entries: ToBuyListEntryWithItem[] = [
    baseEntry,
    { ...baseEntry, id: "buy-2", status: "FULFILLED", quantity_remaining: 0 },
  ];

  it("returns all entries for ALL", () => {
    expect(filterToBuyByStatus(entries, "ALL")).toHaveLength(2);
  });

  it("filters by a specific status", () => {
    expect(filterToBuyByStatus(entries, "OPEN")).toEqual([baseEntry]);
    expect(filterToBuyByStatus(entries, "FULFILLED")[0]?.id).toBe("buy-2");
  });
});
