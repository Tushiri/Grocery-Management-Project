import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateBrowserClient = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: (...args: unknown[]) => mockCreateBrowserClient(...args),
}));

describe("supabaseBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    mockCreateBrowserClient.mockReturnValue({ auth: {} });
  });

  it("creates a browser client with public Supabase env vars", async () => {
    const { supabaseBrowser } = await import("../client");

    const client = supabaseBrowser();

    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key"
    );
    expect(client).toEqual({ auth: {} });
  });
});
