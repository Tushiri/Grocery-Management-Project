import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSupabaseServer = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: () => mockSupabaseServer(),
}));

describe("POST /api/household/bootstrap", () => {
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
      rpc: vi.fn(),
    });

    const { POST } = await import("../route");
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Not authenticated" });
  });

  it("returns 500 when bootstrap_household RPC fails", async () => {
    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "RPC error" },
      }),
    });

    const { POST } = await import("../route");
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "RPC error" });
  });

  it("returns householdId on success", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: "household-456",
      error: null,
    });

    mockSupabaseServer.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
          error: null,
        }),
      },
      rpc: mockRpc,
    });

    const { POST } = await import("../route");
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ householdId: "household-456" });
    expect(mockRpc).toHaveBeenCalledWith("bootstrap_household");
  });
});
