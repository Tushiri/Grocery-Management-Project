import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RealtimeChangePayload } from "../useRealtimeSubscription";

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

type TestItem = { id: string; name: string };

function applyTestEvent(
  current: TestItem[],
  payload: RealtimeChangePayload<TestItem>
): TestItem[] {
  if (payload.eventType === "INSERT" && payload.new) {
    return [...current, payload.new];
  }
  if (payload.eventType === "DELETE") {
    return current.filter((item) => item.id !== payload.old?.id);
  }
  return current;
}

describe("useRealtimeSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postgresCallback = undefined;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("subscribes to postgres_changes and applies events through the supplied reducer", async () => {
    const { useRealtimeSubscription } = await import("../useRealtimeSubscription");
    const { result, rerender } = renderHook(
      ({ initial }) =>
        useRealtimeSubscription("test:household-1", "test_table", "household-1", initial, applyTestEvent),
      { initialProps: { initial: [] as TestItem[] } }
    );

    expect(mockChannel).toHaveBeenCalledWith("test:household-1");
    expect(mockOn).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        table: "test_table",
        filter: "household_id=eq.household-1",
      }),
      expect.any(Function)
    );

    rerender({ initial: [{ id: "1", name: "Milk" }] });
    await waitFor(() => expect(result.current).toEqual([{ id: "1", name: "Milk" }]));

    act(() => {
      postgresCallback?.({ eventType: "INSERT", new: { id: "2", name: "Eggs" }, old: null });
    });
    expect(result.current).toHaveLength(2);

    act(() => {
      postgresCallback?.({
        eventType: "DELETE",
        new: null,
        old: { id: "1", name: "Milk" },
      });
    });
    expect(result.current).toHaveLength(1);
  });

  it("unsubscribes from the channel on unmount", async () => {
    const { useRealtimeSubscription } = await import("../useRealtimeSubscription");
    const { unmount } = renderHook(() =>
      useRealtimeSubscription("test:household-1", "test_table", "household-1", [], applyTestEvent)
    );
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
