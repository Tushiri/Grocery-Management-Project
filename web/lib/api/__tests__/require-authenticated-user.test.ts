import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockSupabaseServer = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: () => mockSupabaseServer(),
}));

describe("requireAuthenticatedUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns supabase and user when authenticated", async () => {
    const supabase = { auth: { getUser: mockGetUser }, from: vi.fn() };
    mockSupabaseServer.mockResolvedValue(supabase);
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const { requireAuthenticatedUser } = await import("../require-authenticated-user");
    const result = await requireAuthenticatedUser();

    expect(result).toEqual({ supabase, user: { id: "user-1" } });
  });

  it("returns 401 when user is missing", async () => {
    mockSupabaseServer.mockResolvedValue({ auth: { getUser: mockGetUser } });
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "No session" } });

    const { requireAuthenticatedUser } = await import("../require-authenticated-user");
    const result = await requireAuthenticatedUser();

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });
});

describe("parseJsonBody", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("parses valid JSON body", async () => {
    const { parseJsonBody } = await import("../require-authenticated-user");
    const body = await parseJsonBody<{ foo: string }>(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ foo: "bar" }),
      })
    );

    expect(body).toEqual({ foo: "bar" });
  });

  it("returns 400 for malformed JSON", async () => {
    const { parseJsonBody } = await import("../require-authenticated-user");
    const result = await parseJsonBody(
      new Request("http://localhost", {
        method: "POST",
        body: "{ invalid",
      })
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});

describe("isNextResponse", () => {
  it("detects NextResponse instances", async () => {
    const { isNextResponse } = await import("../require-authenticated-user");
    expect(isNextResponse(NextResponse.json({ ok: true }))).toBe(true);
    expect(isNextResponse({ ok: true })).toBe(false);
  });
});
