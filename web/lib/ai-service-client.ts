/** Server-only fetch wrapper for the G-rocery AI microservice. */

import type {
  ApproveReceiptRequest,
  ApproveReceiptResponse,
  ProcessReceiptRequest,
  ProcessReceiptResponse,
} from "@/lib/receipts/types";

export class AiServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiServiceError";
  }
}

function serviceHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Service-Token": process.env.AI_SERVICE_TOKEN!,
    "X-Correlation-ID": crypto.randomUUID(),
  };
}

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string; error?: string };
    if (typeof body.detail === "string") {
      return body.detail;
    }
    if (typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // fall through to generic message
  }
  return "AI service request failed";
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new AiServiceError(await parseErrorResponse(response));
  }
  return (await response.json()) as T;
}

export async function processReceipt(
  payload: ProcessReceiptRequest
): Promise<ProcessReceiptResponse> {
  return requestJson<ProcessReceiptResponse>(
    `${process.env.AI_SERVICE_URL}/api/process-receipt`,
    {
      method: "POST",
      headers: serviceHeaders(),
      body: JSON.stringify(payload),
    }
  );
}

export async function approveReceipt(
  pendingReceiptId: string,
  payload: ApproveReceiptRequest
): Promise<ApproveReceiptResponse> {
  return requestJson<ApproveReceiptResponse>(
    `${process.env.AI_SERVICE_URL}/api/process-receipt/${pendingReceiptId}/approve`,
    {
      method: "POST",
      headers: serviceHeaders(),
      body: JSON.stringify(payload),
    }
  );
}
