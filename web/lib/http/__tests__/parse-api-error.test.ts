import { describe, expect, it } from "vitest";

import { parseJsonError } from "../parse-api-error";

describe("parseJsonError", () => {
  it("returns error field when present", async () => {
    const response = new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
    await expect(parseJsonError(response, "fallback")).resolves.toBe("Bad request");
  });

  it("returns detail field when error is absent", async () => {
    const response = new Response(JSON.stringify({ detail: "Not found" }), { status: 404 });
    await expect(parseJsonError(response, "fallback")).resolves.toBe("Not found");
  });

  it("returns fallback when body is not JSON", async () => {
    const response = new Response("not json", { status: 500 });
    await expect(parseJsonError(response, "Server error")).resolves.toBe("Server error");
  });

  it("returns fallback when JSON has no error or detail", async () => {
    const response = new Response(JSON.stringify({ code: 500 }), { status: 500 });
    await expect(parseJsonError(response, "Processing failed")).resolves.toBe("Processing failed");
  });
});
