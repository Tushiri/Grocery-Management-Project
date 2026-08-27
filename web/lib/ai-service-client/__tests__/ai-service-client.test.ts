import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();

vi.stubGlobal("fetch", mockFetch);

describe("ai-service-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    process.env.AI_SERVICE_TOKEN = "test-token";
  });

  it("processReceipt calls FastAPI with service token and correlation id", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ pending_receipt_id: "r-1", status: "PENDING" }), {
        status: 200,
      })
    );

    const { processReceipt } = await import("../../ai-service-client");
    const payload = {
      pending_receipt_id: "r-1",
      household_id: "h-1",
      storage_path: "h-1/file.jpg",
    };

    const result = await processReceipt(payload);

    expect(result.pending_receipt_id).toBe("r-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/process-receipt",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Service-Token": "test-token",
        }),
        body: JSON.stringify(payload),
      })
    );
    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["X-Correlation-ID"]).toBeTruthy();
  });

  it("approveReceipt calls FastAPI approve endpoint", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ pending_receipt_id: "r-1", status: "APPROVED" }), {
        status: 200,
      })
    );

    const { approveReceipt } = await import("../../ai-service-client");
    const payload = { line_items: [] };

    const result = await approveReceipt("r-1", payload);

    expect(result.status).toBe("APPROVED");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/process-receipt/r-1/approve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  });

  it("throws with detail message on non-2xx response", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invalid receipt" }), { status: 400 })
    );

    const { processReceipt } = await import("../../ai-service-client");

    await expect(
      processReceipt({
        pending_receipt_id: "r-1",
        household_id: "h-1",
        storage_path: "h-1/file.jpg",
      })
    ).rejects.toThrow("Invalid receipt");
  });

  it("throws with error field when response includes error", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "Service unavailable" }), { status: 503 })
    );

    const { processReceipt } = await import("../../ai-service-client");

    await expect(
      processReceipt({
        pending_receipt_id: "r-1",
        household_id: "h-1",
        storage_path: "h-1/file.jpg",
      })
    ).rejects.toThrow("Service unavailable");
  });

  it("throws generic message when response has no detail", async () => {
    mockFetch.mockResolvedValue(new Response("bad gateway", { status: 502 }));

    const { approveReceipt } = await import("../../ai-service-client");

    await expect(approveReceipt("r-1", { line_items: [] })).rejects.toThrow(
      "AI service request failed"
    );
  });
});
