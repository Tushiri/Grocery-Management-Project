import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InventoryItem } from "@/lib/types/database.types";

const mockUnsubscribe = vi.fn();
let postgresCallback: ((payload: unknown) => void) | undefined;

const mockSubscribe = vi.fn(() => ({ unsubscribe: mockUnsubscribe }));
const mockOn = vi.fn((_event, _config, callback) => {
  postgresCallback = callback;
  return { on: mockOn, subscribe: mockSubscribe };
});
const mockChannel = vi.fn(() => ({ on: mockOn, subscribe: mockSubscribe }));

vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({
    channel: mockChannel,
  }),
}));

const initialItem: InventoryItem = {
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

describe("useRealtimeInventory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postgresCallback = undefined;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("subscribes to inventory postgres_changes and applies INSERT, UPDATE, and DELETE payloads", async () => {
    const { useRealtimeInventory } = await import("../useRealtimeInventory");
    const { result, rerender } = renderHook(
      ({ items }) => useRealtimeInventory("household-1", items),
      { initialProps: { items: [] as InventoryItem[] } }
    );

    expect(mockChannel).toHaveBeenCalledWith("inventory:household-1");
    expect(mockOn).toHaveBeenCalled();
    expect(mockSubscribe).toHaveBeenCalled();

    rerender({ items: [initialItem] });
    await waitFor(() => expect(result.current).toEqual([initialItem]));

    const inserted = { ...initialItem, id: "item-2", standardized_name: "Eggs" };
    act(() => {
      postgresCallback?.({ eventType: "INSERT", new: inserted, old: null });
    });
    expect(result.current).toHaveLength(2);

    const updated = { ...initialItem, quantity: 1 };
    act(() => {
      postgresCallback?.({ eventType: "UPDATE", new: updated, old: initialItem });
    });
    expect(result.current[0]?.quantity).toBe(1);

    act(() => {
      postgresCallback?.({ eventType: "DELETE", new: null, old: updated });
    });
    expect(result.current).toHaveLength(1);

    result.current;
    const { unmount } = renderHook(() => useRealtimeInventory("household-1", []));
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
