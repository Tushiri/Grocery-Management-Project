import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ToBuyListEntryWithItem } from "@/lib/types/database.types";

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

const initialEntry: ToBuyListEntryWithItem = {
  id: "buy-1",
  household_id: "household-1",
  item_id: "item-1",
  quantity_requested: 2,
  quantity_remaining: 2,
  status: "OPEN",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  inventory_items: { standardized_name: "Milk", unit_type: "L" },
};

describe("useToBuyList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postgresCallback = undefined;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("subscribes to to_buy_list postgres_changes and applies realtime payloads", async () => {
    const { useToBuyList } = await import("../useToBuyList");
    const { result, rerender } = renderHook(
      ({ entries }) => useToBuyList("household-1", entries),
      { initialProps: { entries: [] as ToBuyListEntryWithItem[] } }
    );

    expect(mockChannel).toHaveBeenCalledWith("to-buy:household-1");

    rerender({ entries: [initialEntry] });
    await waitFor(() => expect(result.current).toEqual([initialEntry]));

    const inserted = { ...initialEntry, id: "buy-2", status: "PARTIAL" as const };
    act(() => {
      postgresCallback?.({ eventType: "INSERT", new: inserted, old: null });
    });
    expect(result.current).toHaveLength(2);

    act(() => {
      postgresCallback?.({
        eventType: "UPDATE",
        new: { ...initialEntry, quantity_remaining: 1, status: "PARTIAL" },
        old: initialEntry,
      });
    });
    expect(result.current[0]?.status).toBe("PARTIAL");

    act(() => {
      postgresCallback?.({ eventType: "DELETE", new: null, old: initialEntry });
    });
    expect(result.current).toHaveLength(1);
  });

  it("unsubscribes from the channel on unmount", async () => {
    const { useToBuyList } = await import("../useToBuyList");
    const { unmount } = renderHook(() => useToBuyList("household-1", []));
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
