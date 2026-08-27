import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSupabaseServer = vi.fn();
const mockApproveReceipt = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: () => mockSupabaseServer(),
}));

vi.mock("@/lib/ai-service-client", () => ({
  approveReceipt: (...args: unknown[]) => mockApproveReceipt(...args),
}));

const RECEIPT_ID = "receipt-22222222-2222-2222-2222-222222222222";

describe("POST /api/receipts/[id]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 when the caller is not authenticated", async () => {
    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "No session" },
        }),
      },
      from: vi.fn(),
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/receipts/x/approve", {
        method: "POST",
        body: JSON.stringify({ line_items: [] }),
      }),
      { params: Promise.resolve({ id: RECEIPT_ID }) }
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when receipt is not found", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/receipts/x/approve", {
        method: "POST",
        body: JSON.stringify({ line_items: [] }),
      }),
      { params: Promise.resolve({ id: RECEIPT_ID }) }
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 when receipt is not pending", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: RECEIPT_ID, status: "APPROVED" },
      error: null,
    });
    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/receipts/x/approve", {
        method: "POST",
        body: JSON.stringify({ line_items: [] }),
      }),
      { params: Promise.resolve({ id: RECEIPT_ID }) }
    );

    expect(response.status).toBe(400);
  });

  it("returns 502 when AI service fails", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: RECEIPT_ID, status: "PENDING" },
      error: null,
    });
    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
    });
    mockApproveReceipt.mockRejectedValue(new Error("AI error"));

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/receipts/x/approve", {
        method: "POST",
        body: JSON.stringify({ line_items: [] }),
      }),
      { params: Promise.resolve({ id: RECEIPT_ID }) }
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("AI error");
  });

  it("returns generic error when AI service throws non-Error", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: RECEIPT_ID, status: "PENDING" },
      error: null,
    });
    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
    });
    mockApproveReceipt.mockRejectedValue("broken");

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/receipts/x/approve", {
        method: "POST",
        body: JSON.stringify({ line_items: [] }),
      }),
      { params: Promise.resolve({ id: RECEIPT_ID }) }
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("AI service request failed");
  });

  it("returns approved response on success", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: RECEIPT_ID, status: "PENDING" },
      error: null,
    });
    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle,
          }),
        }),
      }),
    });
    mockApproveReceipt.mockResolvedValue({
      pending_receipt_id: RECEIPT_ID,
      status: "APPROVED",
    });

    const lineItems = [
      {
        raw_text: "MILK",
        standardized_name: "Milk",
        quantity: 1,
        unit_price: 3,
        total_price: 3,
        category: null,
        matched_item_id: "item-1",
        matched_via: "lookup" as const,
      },
    ];

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/receipts/x/approve", {
        method: "POST",
        body: JSON.stringify({ line_items: lineItems }),
      }),
      { params: Promise.resolve({ id: RECEIPT_ID }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("APPROVED");
    expect(mockApproveReceipt).toHaveBeenCalledWith(RECEIPT_ID, { line_items: lineItems });
  });
});
