import { NextResponse } from "next/server";

import { processReceipt } from "@/lib/ai-service-client";
import { getHouseholdIdForUser } from "@/lib/household/get-household-id";
import { supabaseServer } from "@/lib/supabase/server";

type CreateReceiptBody = {
  storagePath?: string;
  storeName?: string;
};

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await req.json()) as CreateReceiptBody;
  const storagePath = body.storagePath?.trim();
  const storeName = body.storeName?.trim() ?? "";

  if (!storagePath) {
    return NextResponse.json({ error: "storagePath is required" }, { status: 400 });
  }

  let householdId: string;
  try {
    householdId = await getHouseholdIdForUser();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Household lookup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!storagePath.startsWith(`${householdId}/`)) {
    return NextResponse.json({ error: "Invalid storage path for household" }, { status: 400 });
  }

  const { data: pendingReceipt, error: insertError } = await supabase
    .from("pending_receipt")
    .insert({
      household_id: householdId,
      raw_image_url: storagePath,
      store_name: storeName || null,
      status: "PENDING",
    })
    .select("id, household_id")
    .single();

  if (insertError || !pendingReceipt) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create pending receipt" },
      { status: 500 }
    );
  }

  try {
    const aiResponse = await processReceipt({
      pending_receipt_id: pendingReceipt.id,
      household_id: pendingReceipt.household_id,
      storage_path: storagePath,
    });
    return NextResponse.json(aiResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI service request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
