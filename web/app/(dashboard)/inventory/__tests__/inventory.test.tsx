import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InventoryItem } from "@/lib/types/database.types";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockCreateInventoryItem = vi.fn();
const mockDepleteInventoryItem = vi.fn();
const mockUseRealtimeInventory = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("@/app/actions/inventory", () => ({
  createInventoryItem: (...args: unknown[]) => mockCreateInventoryItem(...args),
  depleteInventoryItem: (...args: unknown[]) => mockDepleteInventoryItem(...args),
}));

vi.mock("@/lib/hooks/useRealtimeInventory", () => ({
  useRealtimeInventory: (...args: unknown[]) => mockUseRealtimeInventory(...args),
}));

const inventoryItem: InventoryItem = {
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

describe("Inventory dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateInventoryItem.mockResolvedValue({});
    mockDepleteInventoryItem.mockResolvedValue({});
    mockUseRealtimeInventory.mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  it("renders the empty state when there are no inventory items", async () => {
    const { InventoryTable } = await import("@/components/inventory/InventoryTable");
    render(<InventoryTable householdId="household-1" initialItems={[]} />);

    expect(screen.getByText(/no items yet/i)).toBeInTheDocument();
    expect(mockUseRealtimeInventory).toHaveBeenCalledWith("household-1", []);
  });

  it("renders inventory rows from realtime state", async () => {
    mockUseRealtimeInventory.mockReturnValue([inventoryItem]);
    const { InventoryTable } = await import("@/components/inventory/InventoryTable");
    render(<InventoryTable householdId="household-1" initialItems={[inventoryItem]} />);

    expect(screen.getByText("Milk")).toBeInTheDocument();
    expect(screen.getByText("2 L")).toBeInTheDocument();
  });

  it("submits a new inventory item through the server action", async () => {
    const { InventoryTable } = await import("@/components/inventory/InventoryTable");
    const user = userEvent.setup();

    render(<InventoryTable householdId="household-1" initialItems={[]} />);

    await user.type(screen.getByLabelText(/^name$/i), "Eggs");
    await user.type(screen.getByLabelText(/^unit$/i), "pcs");
    await user.click(screen.getByRole("button", { name: /add item/i }));

    await waitFor(() => {
      expect(mockCreateInventoryItem).toHaveBeenCalled();
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows an error when manual item creation fails", async () => {
    mockCreateInventoryItem.mockResolvedValue({ error: "Could not create item" });
    const { InventoryTable } = await import("@/components/inventory/InventoryTable");
    const user = userEvent.setup();

    render(<InventoryTable householdId="household-1" initialItems={[]} />);

    await user.type(screen.getByLabelText(/^name$/i), "Eggs");
    await user.type(screen.getByLabelText(/^unit$/i), "pcs");
    await user.click(screen.getByRole("button", { name: /add item/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Could not create item");
    });
  });

  it("triggers deplete when the deplete button is clicked", async () => {
    mockUseRealtimeInventory.mockReturnValue([inventoryItem]);
    const { InventoryTable } = await import("@/components/inventory/InventoryTable");
    const user = userEvent.setup();

    render(<InventoryTable householdId="household-1" initialItems={[inventoryItem]} />);

    await user.click(screen.getByRole("button", { name: /deplete/i }));

    await waitFor(() => {
      expect(mockDepleteInventoryItem).toHaveBeenCalledWith("item-1");
    });
  });

  it("shows an error when deplete fails", async () => {
    mockUseRealtimeInventory.mockReturnValue([inventoryItem]);
    mockDepleteInventoryItem.mockResolvedValue({ error: "Deplete failed" });
    const { InventoryTable } = await import("@/components/inventory/InventoryTable");
    const user = userEvent.setup();

    render(<InventoryTable householdId="household-1" initialItems={[inventoryItem]} />);

    await user.click(screen.getByRole("button", { name: /deplete/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Deplete failed");
    });
  });

  it("disables deplete when quantity is already zero", async () => {
    mockUseRealtimeInventory.mockReturnValue([{ ...inventoryItem, quantity: 0 }]);
    const { InventoryTable } = await import("@/components/inventory/InventoryTable");

    render(<InventoryTable householdId="household-1" initialItems={[{ ...inventoryItem, quantity: 0 }]} />);

    expect(screen.getByRole("button", { name: /deplete/i })).toBeDisabled();
  });
});
