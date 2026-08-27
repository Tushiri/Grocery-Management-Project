import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetHouseholdId = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/household/get-household-id", () => ({
  getHouseholdIdForUser: () => mockGetHouseholdId(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({ from: mockFrom })),
}));

describe("to-buy server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetHouseholdId.mockResolvedValue("household-1");
  });

  it("adds a to-buy entry for a household inventory item", async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: "item-1" }, error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

    const { addToBuyListEntry } = await import("../to-buy");
    const formData = new FormData();
    formData.set("item_id", "item-1");
    formData.set("quantity_requested", "2");

    await expect(addToBuyListEntry(formData)).resolves.toEqual({});
  });

  it("returns validation errors", async () => {
    const { addToBuyListEntry } = await import("../to-buy");

    await expect(addToBuyListEntry(new FormData())).resolves.toEqual({
      error: "Inventory item is required.",
    });

    const formData = new FormData();
    formData.set("item_id", "item-1");
    formData.set("quantity_requested", "0");
    await expect(addToBuyListEntry(formData)).resolves.toEqual({
      error: "Quantity must be greater than zero.",
    });
  });

  it("returns an error when the inventory item is not in the household", async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    const { addToBuyListEntry } = await import("../to-buy");
    const formData = new FormData();
    formData.set("item_id", "missing");
    formData.set("quantity_requested", "1");

    await expect(addToBuyListEntry(formData)).resolves.toEqual({
      error: "Inventory item not found in your household.",
    });
  });

  it("returns insert errors from Supabase", async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: "item-1" }, error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: { message: "insert failed" } }),
      });

    const { addToBuyListEntry } = await import("../to-buy");
    const formData = new FormData();
    formData.set("item_id", "item-1");
    formData.set("quantity_requested", "1");

    await expect(addToBuyListEntry(formData)).resolves.toEqual({ error: "insert failed" });
  });

  it("handles unexpected failures", async () => {
    mockGetHouseholdId.mockRejectedValue(new Error("auth failed"));

    const { addToBuyListEntry } = await import("../to-buy");
    const formData = new FormData();
    formData.set("item_id", "item-1");
    formData.set("quantity_requested", "1");

    await expect(addToBuyListEntry(formData)).resolves.toEqual({ error: "auth failed" });
  });

  it("handles non-error throws", async () => {
    mockGetHouseholdId.mockRejectedValue("broken");

    const { addToBuyListEntry } = await import("../to-buy");
    const formData = new FormData();
    formData.set("item_id", "item-1");
    formData.set("quantity_requested", "1");

    await expect(addToBuyListEntry(formData)).resolves.toEqual({
      error: "Could not add to-buy entry.",
    });
  });
});
