import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSupabaseServer = vi.fn();
const mockGetHouseholdId = vi.fn();
const mockProcessReceipt = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: () => mockSupabaseServer(),
}));

vi.mock("@/lib/household/get-household-id", () => ({
  getHouseholdIdForUser: () => mockGetHouseholdId(),
}));

vi.mock("@/lib/ai-service-client", () => ({
  processReceipt: (...args: unknown[]) => mockProcessReceipt(...args),
}));

const HOUSEHOLD_ID = "household-11111111-1111-1111-1111-111111111111";
const RECEIPT_ID = "receipt-22222222-2222-2222-2222-222222222222";

describe("POST /api/receipts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetHouseholdId.mockResolvedValue(HOUSEHOLD_ID);
  });

  it("returns 401 when getUser returns an auth error", async () => {
    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "JWT expired" },
        }),
      },
      from: vi.fn(),
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/receipts", {
        method: "POST",
        body: JSON.stringify({ storagePath: `${HOUSEHOLD_ID}/file.jpg` }),
      })
    );

    expect(response.status).toBe(401);
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
      new Request("http://localhost/api/receipts", {
        method: "POST",
        body: JSON.stringify({ storagePath: `${HOUSEHOLD_ID}/file.jpg`, storeName: "Store" }),
      })
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 when storagePath does not match household", async () => {
    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn(),
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/receipts", {
        method: "POST",
        body: JSON.stringify({ storagePath: "other-household/file.jpg", storeName: "Store" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/storage path/i);
  });

  it("returns 400 when storagePath is blank after trimming", async () => {
    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn(),
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/receipts", {
        method: "POST",
        body: JSON.stringify({ storagePath: "   ", storeName: "Store" }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when storagePath is missing", async () => {
    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn(),
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/receipts", {
        method: "POST",
        body: JSON.stringify({ storeName: "Store" }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when household lookup fails", async () => {
    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn(),
    });
    mockGetHouseholdId.mockRejectedValue(new Error("No household membership found"));

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/receipts", {
        method: "POST",
        body: JSON.stringify({
          storagePath: `${HOUSEHOLD_ID}/file.jpg`,
          storeName: "Store",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("No household membership found");
  });

  it("returns generic message when household lookup throws non-Error", async () => {
    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn(),
    });
    mockGetHouseholdId.mockRejectedValue("broken");

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/receipts", {
        method: "POST",
        body: JSON.stringify({
          storagePath: `${HOUSEHOLD_ID}/file.jpg`,
          storeName: "Store",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Household lookup failed");
  });

  it("returns 500 when insert succeeds without returning a row", async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    });

    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({ insert: mockInsert }),
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/receipts", {
        method: "POST",
        body: JSON.stringify({
          storagePath: `${HOUSEHOLD_ID}/file.jpg`,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to create pending receipt");
  });

  it("returns 502 when AI service throws non-Error", async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: RECEIPT_ID, household_id: HOUSEHOLD_ID },
          error: null,
        }),
      }),
    });

    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({ insert: mockInsert }),
    });

    mockProcessReceipt.mockRejectedValue("broken");

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/receipts", {
        method: "POST",
        body: JSON.stringify({
          storagePath: `${HOUSEHOLD_ID}/file.jpg`,
          storeName: "",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("AI service request failed");
  });

  it("returns 500 when pending_receipt insert fails", async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Insert failed" },
        }),
      }),
    });

    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({ insert: mockInsert }),
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/receipts", {
        method: "POST",
        body: JSON.stringify({
          storagePath: `${HOUSEHOLD_ID}/file.jpg`,
          storeName: "Store",
        }),
      })
    );

    expect(response.status).toBe(500);
  });

  it("returns 502 when AI service fails", async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: RECEIPT_ID, household_id: HOUSEHOLD_ID },
          error: null,
        }),
      }),
    });

    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({ insert: mockInsert }),
    });

    mockProcessReceipt.mockRejectedValue(new Error("AI down"));

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/receipts", {
        method: "POST",
        body: JSON.stringify({
          storagePath: `${HOUSEHOLD_ID}/file.jpg`,
          storeName: "Store",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("AI down");
  });

  it("returns process receipt response on success", async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: RECEIPT_ID, household_id: HOUSEHOLD_ID },
          error: null,
        }),
      }),
    });

    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({ insert: mockInsert }),
    });

    mockProcessReceipt.mockResolvedValue({
      pending_receipt_id: RECEIPT_ID,
      status: "PENDING",
      parsed: { store_name: "Store", date_purchased: "2026-08-27", line_items: [] },
      matched_via_lookup_count: 1,
      matched_via_gemini_count: 0,
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/receipts", {
        method: "POST",
        body: JSON.stringify({
          storagePath: `${HOUSEHOLD_ID}/file.jpg`,
          storeName: "Store",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pending_receipt_id).toBe(RECEIPT_ID);
    expect(mockProcessReceipt).toHaveBeenCalledWith({
      pending_receipt_id: RECEIPT_ID,
      household_id: HOUSEHOLD_ID,
      storage_path: `${HOUSEHOLD_ID}/file.jpg`,
    });
  });
});
