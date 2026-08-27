import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

describe("getHouseholdIdForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns the household id for an authenticated member", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { household_id: "household-1" },
              error: null,
            }),
          }),
        }),
      }),
    });

    const { getHouseholdIdForUser } = await import("../get-household-id");
    await expect(getHouseholdIdForUser()).resolves.toBe("household-1");
  });

  it("throws when the user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "No session" } });

    const { getHouseholdIdForUser } = await import("../get-household-id");
    await expect(getHouseholdIdForUser()).rejects.toThrow("Not authenticated");
  });

  it("throws when no household membership exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    const { getHouseholdIdForUser } = await import("../get-household-id");
    await expect(getHouseholdIdForUser()).rejects.toThrow("No household membership found");
  });
});
