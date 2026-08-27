import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InventoryItem, ToBuyListEntryWithItem } from "@/lib/types/database.types";

const mockRefresh = vi.fn();
const mockAddToBuyListEntry = vi.fn();
const mockUseToBuyList = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/app/actions/to-buy", () => ({
  addToBuyListEntry: (...args: unknown[]) => mockAddToBuyListEntry(...args),
}));

vi.mock("@/lib/hooks/useToBuyList", () => ({
  useToBuyList: (...args: unknown[]) => mockUseToBuyList(...args),
}));

const inventoryItem: InventoryItem = {
  id: "item-1",
  household_id: "household-1",
  standardized_name: "Milk",
  quantity: 1,
  unit_type: "L",
  category: null,
  priority_tag: "HIGH",
  min_threshold: 3,
  expiration_date: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const openEntry: ToBuyListEntryWithItem = {
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

const fulfilledEntry: ToBuyListEntryWithItem = {
  ...openEntry,
  id: "buy-2",
  status: "FULFILLED",
  quantity_remaining: 0,
};

describe("To-buy dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddToBuyListEntry.mockResolvedValue({});
    mockUseToBuyList.mockReturnValue([openEntry, fulfilledEntry]);
  });

  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  it("renders OPEN entries by default", async () => {
    const { ToBuyList } = await import("@/components/to-buy/ToBuyList");
    render(
      <ToBuyList
        householdId="household-1"
        initialEntries={[openEntry, fulfilledEntry]}
        inventoryItems={[inventoryItem]}
      />
    );

    expect(screen.getByText(/status: open/i)).toBeInTheDocument();
    expect(screen.queryByText(/status: fulfilled/i)).not.toBeInTheDocument();
  });

  it("filters entries by PARTIAL and FULFILLED status", async () => {
    mockUseToBuyList.mockReturnValue([
      openEntry,
      { ...openEntry, id: "buy-3", status: "PARTIAL", quantity_remaining: 1 },
      fulfilledEntry,
    ]);

    const { ToBuyList } = await import("@/components/to-buy/ToBuyList");
    const user = userEvent.setup();

    render(
      <ToBuyList
        householdId="household-1"
        initialEntries={[openEntry, fulfilledEntry]}
        inventoryItems={[inventoryItem]}
      />
    );

    await user.click(screen.getByRole("button", { name: "PARTIAL" }));
    expect(screen.getByText(/status: partial/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "FULFILLED" }));
    expect(screen.getByText(/status: fulfilled/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ALL" }));
    expect(screen.getAllByText("Milk").length).toBeGreaterThan(0);
  });

  it("shows an empty state for a filter with no entries", async () => {
    mockUseToBuyList.mockReturnValue([fulfilledEntry]);
    const { ToBuyList } = await import("@/components/to-buy/ToBuyList");

    render(
      <ToBuyList
        householdId="household-1"
        initialEntries={[fulfilledEntry]}
        inventoryItems={[inventoryItem]}
      />
    );

    expect(screen.getByText(/no to-buy entries for this filter/i)).toBeInTheDocument();
  });

  it("adds a manual to-buy entry through the server action", async () => {
    const { ToBuyList } = await import("@/components/to-buy/ToBuyList");
    const user = userEvent.setup();

    render(
      <ToBuyList
        householdId="household-1"
        initialEntries={[openEntry]}
        inventoryItems={[inventoryItem]}
      />
    );

    await user.selectOptions(screen.getByLabelText(/inventory item/i), "item-1");
    await user.click(screen.getByRole("button", { name: /add to list/i }));

    await waitFor(() => {
      expect(mockAddToBuyListEntry).toHaveBeenCalled();
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows an error when manual add fails", async () => {
    mockAddToBuyListEntry.mockResolvedValue({ error: "Add failed" });
    const { ToBuyList } = await import("@/components/to-buy/ToBuyList");
    const user = userEvent.setup();

    render(
      <ToBuyList
        householdId="household-1"
        initialEntries={[openEntry]}
        inventoryItems={[inventoryItem]}
      />
    );

    await user.selectOptions(screen.getByLabelText(/inventory item/i), "item-1");
    await user.click(screen.getByRole("button", { name: /add to list/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Add failed");
    });
  });

  it("renders unknown item names when the join is missing", async () => {
    mockUseToBuyList.mockReturnValue([
      { ...openEntry, inventory_items: null },
    ]);

    const { ToBuyList } = await import("@/components/to-buy/ToBuyList");
    render(
      <ToBuyList
        householdId="household-1"
        initialEntries={[{ ...openEntry, inventory_items: null }]}
        inventoryItems={[inventoryItem]}
      />
    );

    expect(screen.getByText("Unknown item")).toBeInTheDocument();
  });
});
