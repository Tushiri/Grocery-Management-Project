import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("redirects unauthenticated sessions to /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const DashboardLayout = (await import("../layout")).default;

    await expect(
      DashboardLayout({ children: <div>Protected content</div> })
    ).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirects when getUser returns an auth error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "JWT expired" },
    });

    const DashboardLayout = (await import("../layout")).default;

    await expect(
      DashboardLayout({ children: <div>Protected content</div> })
    ).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("renders children for authenticated sessions", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "member@example.com" } },
      error: null,
    });

    const DashboardLayout = (await import("../layout")).default;
    const result = await DashboardLayout({
      children: <div>Protected content</div>,
    });

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });
});
