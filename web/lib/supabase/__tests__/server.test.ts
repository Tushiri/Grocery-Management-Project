import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateServerClient = vi.fn();
const mockGetAll = vi.fn();
const mockSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: mockGetAll,
    set: mockSet,
  })),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

describe("supabaseServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    mockGetAll.mockReturnValue([{ name: "session", value: "abc" }]);
    mockCreateServerClient.mockImplementation((_url, _key, options) => {
      options.cookies.getAll();
      options.cookies.setAll([{ name: "session", value: "updated", options: { path: "/" } }]);
      return { auth: {} };
    });
  });

  it("creates a server client wired to the request cookie store", async () => {
    const { supabaseServer } = await import("../server");

    const client = await supabaseServer();

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
    expect(mockGetAll).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith("session", "updated", { path: "/" });
    expect(client).toEqual({ auth: {} });
  });

  it("ignores cookie write errors from Server Components", async () => {
    mockSet.mockImplementation(() => {
      throw new Error("read-only cookie store");
    });
    mockCreateServerClient.mockImplementation((_url, _key, options) => {
      expect(() =>
        options.cookies.setAll([{ name: "session", value: "updated", options: { path: "/" } }])
      ).not.toThrow();
      return { auth: {} };
    });

    const { supabaseServer } = await import("../server");
    await supabaseServer();
  });
});
