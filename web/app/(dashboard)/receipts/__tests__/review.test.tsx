import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ParsedReceipt } from "@/lib/receipts/types";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.stubGlobal("fetch", vi.fn());

const RECEIPT_ID = "receipt-22222222-2222-2222-2222-222222222222";

const parsedReceipt: ParsedReceipt = {
  store_name: "Costco",
  date_purchased: "2026-08-27",
  line_items: [
    {
      raw_text: "ORG MILK",
      standardized_name: "Organic Milk",
      quantity: 2,
      unit_price: 3.5,
      total_price: 7,
      category: "Dairy",
      matched_item_id: "item-11111111-1111-1111-1111-111111111111",
      matched_via: "lookup",
    },
    {
      raw_text: "UNKNOWN ITEM",
      standardized_name: "Unknown Item",
      quantity: 1,
      unit_price: 4,
      total_price: 4,
      category: null,
      matched_item_id: null,
      matched_via: "gemini",
    },
  ],
};

describe("ReceiptReviewForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ pending_receipt_id: RECEIPT_ID, status: "APPROVED" }),
        { status: 200 }
      )
    );
  });

  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  it("renders parsed line items with matched_via badges", async () => {
    const { ReceiptReviewForm } = await import("@/components/receipts/ReceiptReviewForm");
    render(
      <ReceiptReviewForm
        pendingReceiptId={RECEIPT_ID}
        parsed={parsedReceipt}
        status="PENDING"
      />
    );

    expect(screen.getByText("Organic Milk")).toBeInTheDocument();
    expect(screen.getByText("Unknown Item")).toBeInTheDocument();
    expect(screen.getByText("lookup")).toBeInTheDocument();
    expect(screen.getByText("gemini")).toBeInTheDocument();
    expect(screen.getByText("Costco")).toBeInTheDocument();
  });

  it("updates quantity and recalculates total price", async () => {
    const { ReceiptReviewForm } = await import("@/components/receipts/ReceiptReviewForm");
    const user = userEvent.setup();
    render(
      <ReceiptReviewForm
        pendingReceiptId={RECEIPT_ID}
        parsed={parsedReceipt}
        status="PENDING"
      />
    );

    const quantityInputs = screen.getAllByLabelText(/quantity/i);
    await user.clear(quantityInputs[0]);
    await user.type(quantityInputs[0], "3");

    expect(screen.getByText("$10.50")).toBeInTheDocument();
  });

  it("submits edited line items to the approve endpoint", async () => {
    const { ReceiptReviewForm } = await import("@/components/receipts/ReceiptReviewForm");
    const user = userEvent.setup();
    render(
      <ReceiptReviewForm
        pendingReceiptId={RECEIPT_ID}
        parsed={parsedReceipt}
        status="PENDING"
      />
    );

    const priceInputs = screen.getAllByLabelText(/unit price/i);
    await user.clear(priceInputs[0]);
    await user.type(priceInputs[0], "4");

    await user.click(screen.getByRole("button", { name: /approve receipt/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `/api/receipts/${RECEIPT_ID}/approve`,
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    const callBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(callBody.line_items).toHaveLength(2);
    expect(callBody.line_items[0].unit_price).toBe(4);
    expect(callBody.line_items[0].total_price).toBe(8);
    expect(callBody.line_items[1].matched_item_id).toBeNull();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/inventory");
    });
  });

  it("shows an error when approval fails", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Approval failed" }), { status: 400 })
    );
    const { ReceiptReviewForm } = await import("@/components/receipts/ReceiptReviewForm");
    const user = userEvent.setup();
    render(
      <ReceiptReviewForm
        pendingReceiptId={RECEIPT_ID}
        parsed={parsedReceipt}
        status="PENDING"
      />
    );

    await user.click(screen.getByRole("button", { name: /approve receipt/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Approval failed");
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("uses default approval error message when response has no error field", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 500 }));
    const { ReceiptReviewForm } = await import("@/components/receipts/ReceiptReviewForm");
    const user = userEvent.setup();
    render(
      <ReceiptReviewForm
        pendingReceiptId={RECEIPT_ID}
        parsed={parsedReceipt}
        status="PENDING"
      />
    );

    await user.click(screen.getByRole("button", { name: /approve receipt/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Approval failed");
    });
  });

  it("resets submitting state when fetch throws", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network down"));
    const { ReceiptReviewForm } = await import("@/components/receipts/ReceiptReviewForm");
    const user = userEvent.setup();
    render(
      <ReceiptReviewForm
        pendingReceiptId={RECEIPT_ID}
        parsed={parsedReceipt}
        status="PENDING"
      />
    );

    await user.click(screen.getByRole("button", { name: /approve receipt/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network down");
    });
    expect(screen.getByRole("button", { name: /approve receipt/i })).toBeEnabled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows fallback error when a non-Error is thrown", async () => {
    vi.mocked(fetch).mockRejectedValue("broken");
    const { ReceiptReviewForm } = await import("@/components/receipts/ReceiptReviewForm");
    const user = userEvent.setup();
    render(
      <ReceiptReviewForm
        pendingReceiptId={RECEIPT_ID}
        parsed={parsedReceipt}
        status="PENDING"
      />
    );

    await user.click(screen.getByRole("button", { name: /approve receipt/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Approval failed unexpectedly.");
    });
  });
});
