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

vi.mock("@/components/to-buy/ToBuyList", () => ({
  ToBuyList: ({
    householdId,
    initialEntries,
    inventoryItems,
  }: {
    householdId: string;
    initialEntries: unknown[];
    inventoryItems: unknown[];
  }) => (
    <div>
      ToBuyList:{householdId}:{initialEntries.length}:{inventoryItems.length}
    </div>
  ),
}));

describe("ToBuyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetHouseholdId.mockResolvedValue("household-1");
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [{ id: "buy-1" }], error: null }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [{ id: "item-1" }], error: null }),
          }),
        }),
      });
  });

  it("loads to-buy entries and inventory options", async () => {
    const ToBuyPage = (await import("../page")).default;
    render(await ToBuyPage());

    expect(screen.getByText("ToBuyList:household-1:1:1")).toBeInTheDocument();
  });

  it("renders empty lists when Supabase returns no rows", async () => {
    mockFrom.mockReset();
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

    const ToBuyPage = (await import("../page")).default;
    render(await ToBuyPage());

    expect(screen.getByText("ToBuyList:household-1:0:0")).toBeInTheDocument();
  });
});
