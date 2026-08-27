import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetHouseholdId = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/household/get-household-id", () => ({
  getHouseholdIdForUser: () => mockGetHouseholdId(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({ from: mockFrom })),
}));

const inventoryItem = {
  id: "item-1",
  household_id: "household-1",
  standardized_name: "Milk",
  quantity: 2,
  unit_type: "L",
  category: null,
  priority_tag: "HIGH" as const,
  min_threshold: 5,
  expiration_date: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function mockInventoryInsert(result: unknown) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function mockInventorySelect(result: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function mockInventoryUpdate(result: unknown) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(result),
        }),
      }),
    }),
  };
}

function mockToBuyLookup(existing: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
}

describe("inventory server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetHouseholdId.mockResolvedValue("household-1");
  });

  it("skips auto to-buy for LOW priority items", async () => {
    const lowPriorityItem = { ...inventoryItem, priority_tag: "LOW" as const, quantity: 10, min_threshold: 5 };
    mockFrom.mockReturnValue(mockInventoryInsert({ data: lowPriorityItem, error: null }));

    const { createInventoryItem } = await import("../inventory");
    const formData = new FormData();
    formData.set("standardized_name", "Milk");
    formData.set("unit_type", "L");
    formData.set("quantity", "10");
    formData.set("min_threshold", "5");
    formData.set("priority_tag", "LOW");

    await expect(createInventoryItem(formData)).resolves.toEqual({});
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("creates an inventory item and auto-adds a to-buy entry when stock is low", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "inventory_items") {
        return mockInventoryInsert({ data: inventoryItem, error: null });
      }
      return mockToBuyLookup(null);
    });

    const { createInventoryItem } = await import("../inventory");
    const formData = new FormData();
    formData.set("standardized_name", "Milk");
    formData.set("unit_type", "L");
    formData.set("quantity", "2");
    formData.set("min_threshold", "5");
    formData.set("priority_tag", "HIGH");

    await expect(createInventoryItem(formData)).resolves.toEqual({});
  });

  it("returns validation errors when required fields are missing", async () => {
    const { createInventoryItem } = await import("../inventory");
    const formData = new FormData();
    await expect(createInventoryItem(formData)).resolves.toEqual({
      error: "Name and unit are required.",
    });
  });

  it("returns validation errors for invalid quantity", async () => {
    const { createInventoryItem } = await import("../inventory");
    const formData = new FormData();
    formData.set("standardized_name", "Milk");
    formData.set("unit_type", "L");
    formData.set("quantity", "-1");
    formData.set("min_threshold", "0");

    await expect(createInventoryItem(formData)).resolves.toEqual({
      error: "Quantity must be zero or greater.",
    });
  });

  it("returns validation errors for invalid min threshold", async () => {
    const { createInventoryItem } = await import("../inventory");
    const formData = new FormData();
    formData.set("standardized_name", "Milk");
    formData.set("unit_type", "L");
    formData.set("quantity", "1");
    formData.set("min_threshold", "-1");

    await expect(createInventoryItem(formData)).resolves.toEqual({
      error: "Minimum threshold must be zero or greater.",
    });
  });

  it("returns an error when insert fails", async () => {
    mockFrom.mockReturnValue(
      mockInventoryInsert({ data: null, error: { message: "insert failed" } })
    );

    const { createInventoryItem } = await import("../inventory");
    const formData = new FormData();
    formData.set("standardized_name", "Milk");
    formData.set("unit_type", "L");
    formData.set("quantity", "1");
    formData.set("min_threshold", "0");

    await expect(createInventoryItem(formData)).resolves.toEqual({ error: "insert failed" });
  });

  it("returns a fallback error when insert returns no row", async () => {
    mockFrom.mockReturnValue(mockInventoryInsert({ data: null, error: null }));

    const { createInventoryItem } = await import("../inventory");
    const formData = new FormData();
    formData.set("standardized_name", "Milk");
    formData.set("unit_type", "L");
    formData.set("quantity", "1");
    formData.set("min_threshold", "0");

    await expect(createInventoryItem(formData)).resolves.toEqual({
      error: "Could not create inventory item.",
    });
  });

  it("logs when auto to-buy insert fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const toBuyMock = {
      ...mockToBuyLookup(null),
      insert: vi.fn().mockResolvedValue({ error: { message: "insert failed" } }),
    };
    mockFrom.mockImplementation((table: string) => {
      if (table === "inventory_items") {
        return mockInventoryInsert({
          data: { ...inventoryItem, quantity: 0, min_threshold: 5 },
          error: null,
        });
      }
      return toBuyMock;
    });

    const { createInventoryItem } = await import("../inventory");
    const formData = new FormData();
    formData.set("standardized_name", "Milk");
    formData.set("unit_type", "L");
    formData.set("quantity", "0");
    formData.set("min_threshold", "5");
    formData.set("priority_tag", "HIGH");

    await expect(createInventoryItem(formData)).resolves.toEqual({});
    expect(consoleSpy).toHaveBeenCalledWith(
      "Auto to-buy entry creation failed:",
      "insert failed"
    );
    consoleSpy.mockRestore();
  });

  it("skips auto to-buy when an open entry already exists", async () => {
    const toBuyMock = mockToBuyLookup({ id: "buy-1" });
    mockFrom.mockImplementation((table: string) => {
      if (table === "inventory_items") {
        return mockInventoryInsert({ data: inventoryItem, error: null });
      }
      return toBuyMock;
    });

    const { createInventoryItem } = await import("../inventory");
    const formData = new FormData();
    formData.set("standardized_name", "Milk");
    formData.set("unit_type", "L");
    formData.set("quantity", "2");
    formData.set("min_threshold", "5");
    formData.set("priority_tag", "HIGH");

    await expect(createInventoryItem(formData)).resolves.toEqual({});
    expect(toBuyMock.insert).not.toHaveBeenCalled();
  });

  it("depletes inventory and creates auto to-buy when threshold is crossed", async () => {
    let inventoryCalls = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "inventory_items") {
        inventoryCalls += 1;
        if (inventoryCalls === 1) {
          return mockInventorySelect({ data: inventoryItem, error: null });
        }
        return mockInventoryUpdate({ data: { ...inventoryItem, quantity: 0 }, error: null });
      }
      return mockToBuyLookup(null);
    });

    const { depleteInventoryItem } = await import("../inventory");
    await expect(depleteInventoryItem("item-1")).resolves.toEqual({});
  });

  it("returns errors for invalid deplete requests", async () => {
    const { depleteInventoryItem } = await import("../inventory");
    await expect(depleteInventoryItem("")).resolves.toEqual({ error: "Item id is required." });
    await expect(depleteInventoryItem("item-1", 0)).resolves.toEqual({
      error: "Deplete amount must be greater than zero.",
    });
  });

  it("returns an error when the inventory item is missing", async () => {
    mockFrom.mockReturnValue(mockInventorySelect({ data: null, error: { message: "not found" } }));

    const { depleteInventoryItem } = await import("../inventory");
    await expect(depleteInventoryItem("missing")).resolves.toEqual({ error: "not found" });
  });

  it("returns an error when update fails", async () => {
    let inventoryCalls = 0;
    mockFrom.mockImplementation(() => {
      inventoryCalls += 1;
      if (inventoryCalls === 1) {
        return mockInventorySelect({ data: inventoryItem, error: null });
      }
      return mockInventoryUpdate({ data: null, error: { message: "update failed" } });
    });

    const { depleteInventoryItem } = await import("../inventory");
    await expect(depleteInventoryItem("item-1")).resolves.toEqual({ error: "update failed" });
  });

  it("returns a fallback error when update returns no row", async () => {
    let inventoryCalls = 0;
    mockFrom.mockImplementation((table: string) => {
      inventoryCalls += 1;
      if (inventoryCalls === 1) {
        return mockInventorySelect({ data: inventoryItem, error: null });
      }
      return mockInventoryUpdate({ data: null, error: null });
    });

    const { depleteInventoryItem } = await import("../inventory");
    await expect(depleteInventoryItem("item-1")).resolves.toEqual({
      error: "Could not update inventory item.",
    });
  });

  it("handles unexpected failures during create", async () => {
    mockGetHouseholdId.mockRejectedValue(new Error("auth failed"));

    const { createInventoryItem } = await import("../inventory");
    const formData = new FormData();
    formData.set("standardized_name", "Milk");
    formData.set("unit_type", "L");
    formData.set("quantity", "1");
    formData.set("min_threshold", "0");

    await expect(createInventoryItem(formData)).resolves.toEqual({ error: "auth failed" });
  });

  it("handles non-error throws from create", async () => {
    mockFrom.mockImplementation(() => {
      throw "broken";
    });

    const { createInventoryItem } = await import("../inventory");
    const formData = new FormData();
    formData.set("standardized_name", "Milk");
    formData.set("unit_type", "L");
    formData.set("quantity", "1");
    formData.set("min_threshold", "0");

    await expect(createInventoryItem(formData)).resolves.toEqual({
      error: "Could not create inventory item.",
    });
  });

  it("handles non-error throws from deplete", async () => {
    mockFrom.mockImplementation(() => {
      throw "broken";
    });

    const { depleteInventoryItem } = await import("../inventory");
    await expect(depleteInventoryItem("item-1")).resolves.toEqual({
      error: "Could not deplete inventory item.",
    });
  });

  it("surfaces Error messages thrown during deplete", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("deplete failed");
    });

    const { depleteInventoryItem } = await import("../inventory");
    await expect(depleteInventoryItem("item-1")).resolves.toEqual({ error: "deplete failed" });
  });

  it("returns a fallback error when fetch succeeds without a row", async () => {
    mockFrom.mockReturnValue(mockInventorySelect({ data: null, error: null }));

    const { depleteInventoryItem } = await import("../inventory");
    await expect(depleteInventoryItem("missing")).resolves.toEqual({
      error: "Inventory item not found.",
    });
  });
});
