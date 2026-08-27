import { describe, expect, it, vi } from "vitest";

import { createToBuyEntry } from "../create-to-buy-entry";

describe("createToBuyEntry", () => {
  it("inserts a new open to-buy entry", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ insert }) };

    await expect(
      createToBuyEntry(supabase as never, {
        householdId: "household-1",
        itemId: "item-1",
        quantityRequested: 3,
      })
    ).resolves.toEqual({});

    expect(insert).toHaveBeenCalledWith({
      household_id: "household-1",
      item_id: "item-1",
      quantity_requested: 3,
      quantity_remaining: 3,
      status: "OPEN",
    });
  });

  it("returns error message when insert fails", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: "duplicate key" } });
    const supabase = { from: vi.fn().mockReturnValue({ insert }) };

    await expect(
      createToBuyEntry(supabase as never, {
        householdId: "household-1",
        itemId: "item-1",
        quantityRequested: 1,
      })
    ).resolves.toEqual({ error: "duplicate key" });
  });
});
