import { NextResponse } from "next/server";

import {
  isNextResponse,
  parseJsonBody,
  requireAuthenticatedUser,
} from "@/lib/api/require-authenticated-user";
import { approveReceipt } from "@/lib/ai-service-client";
import type { ApproveReceiptRequest } from "@/lib/receipts/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function validateApproveRequest(body: ApproveReceiptRequest): string | null {
  if (!Array.isArray(body.line_items) || body.line_items.length === 0) {
    return "line_items must be a non-empty array";
  }
  return null;
}

export async function POST(req: Request, context: RouteContext) {
  const auth = await requireAuthenticatedUser();
  if (isNextResponse(auth)) {
    return auth;
  }

  const { id } = await context.params;

  const { data: receipt, error: receiptError } = await auth.supabase
    .from("pending_receipt")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (receiptError || !receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  if (receipt.status !== "PENDING") {
    return NextResponse.json({ error: "Receipt is not pending approval" }, { status: 400 });
  }

  const body = await parseJsonBody<ApproveReceiptRequest>(req);
  if (isNextResponse(body)) {
    return body;
  }

  const validationError = validateApproveRequest(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = await approveReceipt(id, body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI service request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
