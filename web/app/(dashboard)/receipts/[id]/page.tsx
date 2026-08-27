import { notFound } from "next/navigation";

import { ReceiptReviewForm } from "@/components/receipts/ReceiptReviewForm";
import { getHouseholdIdForUser } from "@/lib/household/get-household-id";
import type { ParsedReceipt } from "@/lib/receipts/types";
import { supabaseServer } from "@/lib/supabase/server";

type ReceiptReviewPageProps = {
  params: Promise<{ id: string }>;
};

function isParsedReceipt(value: unknown): value is ParsedReceipt {
  if (!value || typeof value !== "object") {
    return false;
  }
  const parsed = value as ParsedReceipt;
  return (
    typeof parsed.store_name === "string" &&
    typeof parsed.date_purchased === "string" &&
    Array.isArray(parsed.line_items)
  );
}

export default async function ReceiptReviewPage({ params }: ReceiptReviewPageProps) {
  const { id } = await params;
  const householdId = await getHouseholdIdForUser();
  const supabase = await supabaseServer();

  const { data: receipt } = await supabase
    .from("pending_receipt")
    .select("id, status, parsed_json")
    .eq("id", id)
    .eq("household_id", householdId)
    .maybeSingle();

  if (!receipt || receipt.status !== "PENDING" || !isParsedReceipt(receipt.parsed_json)) {
    notFound();
  }

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Review Receipt</h1>
      <ReceiptReviewForm
        pendingReceiptId={receipt.id}
        parsed={receipt.parsed_json}
        status={receipt.status}
      />
    </main>
  );
}
