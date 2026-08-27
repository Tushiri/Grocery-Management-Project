import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetHouseholdId = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/household/get-household-id", () => ({
  getHouseholdIdForUser: () => mockGetHouseholdId(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({ from: mockFrom })),
}));

vi.mock("@/components/inventory/InventoryTable", () => ({
  InventoryTable: ({
    householdId,
    initialItems,
  }: {
    householdId: string;
    initialItems: unknown[];
  }) => (
    <div>
      InventoryTable:{householdId}:{initialItems.length}
    </div>
  ),
}));

describe("InventoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetHouseholdId.mockResolvedValue("household-1");
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [{ id: "item-1" }], error: null }),
        }),
      }),
    });
  });

  it("loads household inventory and renders the table", async () => {
    const InventoryPage = (await import("../page")).default;
    render(await InventoryPage());

    expect(screen.getByText("InventoryTable:household-1:1")).toBeInTheDocument();
  });

  it("renders an empty table when Supabase returns no rows", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const InventoryPage = (await import("../page")).default;
    render(await InventoryPage());

    expect(screen.getByText("InventoryTable:household-1:0")).toBeInTheDocument();
  });
});
