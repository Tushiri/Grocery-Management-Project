/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockCreateServerClient = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  it("refreshes the Supabase session and returns a NextResponse", async () => {
    const { middleware } = await import("@/middleware");
    const request = new NextRequest("http://localhost/inventory");

    mockCreateServerClient.mockImplementation((_url, _key, options) => {
      expect(options.cookies.getAll()).toEqual(request.cookies.getAll());
      options.cookies.setAll([
        { name: "sb-access-token", value: "token", options: { path: "/" } },
      ]);
      return {
        auth: {
          getUser: mockGetUser,
        },
      };
    });

    const response = await middleware(request);

    expect(mockCreateServerClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      })
    );
    expect(mockGetUser).toHaveBeenCalled();
    expect(response).toBeDefined();
    expect(response.cookies.get("sb-access-token")?.value).toBe("token");
  });

  it("exports a matcher config that excludes static assets", async () => {
    const { config } = await import("@/middleware");

    expect(config.matcher[0]).toContain("_next/static");
    expect(config.matcher[0]).toContain("favicon.ico");
  });
});
