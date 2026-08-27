import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetHouseholdId = vi.fn();
const mockNotFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const mockFrom = vi.fn();

vi.mock("@/lib/household/get-household-id", () => ({
  getHouseholdIdForUser: () => mockGetHouseholdId(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({ from: mockFrom })),
}));

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

vi.mock("@/components/receipts/ReceiptReviewForm", () => ({
  ReceiptReviewForm: ({
    pendingReceiptId,
    status,
  }: {
    pendingReceiptId: string;
    status: string;
  }) => (
    <div>
      ReceiptReviewForm:{pendingReceiptId}:{status}
    </div>
  ),
}));

const RECEIPT_ID = "receipt-22222222-2222-2222-2222-222222222222";
const HOUSEHOLD_ID = "household-11111111-1111-1111-1111-111111111111";

const parsedJson = {
  store_name: "Costco",
  date_purchased: "2026-08-27",
  line_items: [
    {
      raw_text: "MILK",
      standardized_name: "Milk",
      quantity: 1,
      unit_price: 3,
      total_price: 3,
      category: null,
      matched_item_id: "item-1",
      matched_via: "lookup",
    },
  ],
};

describe("ReceiptReviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetHouseholdId.mockResolvedValue(HOUSEHOLD_ID);
  });

  it("loads pending receipt and renders review form", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: RECEIPT_ID,
                status: "PENDING",
                parsed_json: parsedJson,
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    const ReceiptReviewPage = (await import("../page")).default;
    const result = await ReceiptReviewPage({ params: Promise.resolve({ id: RECEIPT_ID }) });

    const { render, screen } = await import("@testing-library/react");
    render(result);

    expect(screen.getByText(`ReceiptReviewForm:${RECEIPT_ID}:PENDING`)).toBeInTheDocument();
  });

  it("calls notFound when receipt is missing", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    const ReceiptReviewPage = (await import("../page")).default;

    await expect(
      ReceiptReviewPage({ params: Promise.resolve({ id: RECEIPT_ID }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("calls notFound when receipt is not pending", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: RECEIPT_ID, status: "APPROVED", parsed_json: parsedJson },
              error: null,
            }),
          }),
        }),
      }),
    });

    const ReceiptReviewPage = (await import("../page")).default;

    await expect(
      ReceiptReviewPage({ params: Promise.resolve({ id: RECEIPT_ID }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("calls notFound when parsed_json is invalid", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: RECEIPT_ID, status: "PENDING", parsed_json: null },
              error: null,
            }),
          }),
        }),
      }),
    });

    const ReceiptReviewPage = (await import("../page")).default;

    await expect(
      ReceiptReviewPage({ params: Promise.resolve({ id: RECEIPT_ID }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
