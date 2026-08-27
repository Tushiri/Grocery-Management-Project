import { NextResponse } from "next/server";

import { approveReceipt } from "@/lib/ai-service-client";
import type { ApproveReceiptRequest } from "@/lib/receipts/types";
import { supabaseServer } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  const supabase = await supabaseServer();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await context.params;

  const { data: receipt, error: receiptError } = await supabase
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

  const body = (await req.json()) as ApproveReceiptRequest;

  try {
    const result = await approveReceipt(id, body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI service request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
