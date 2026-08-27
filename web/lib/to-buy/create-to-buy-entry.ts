import type { supabaseServer } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof supabaseServer>>;

export type CreateToBuyEntryInput = {
  householdId: string;
  itemId: string;
  quantityRequested: number;
};

export async function createToBuyEntry(
  supabase: SupabaseClient,
  input: CreateToBuyEntryInput
): Promise<{ error?: string }> {
  const { error } = await supabase.from("to_buy_list").insert({
    household_id: input.householdId,
    item_id: input.itemId,
    quantity_requested: input.quantityRequested,
    quantity_remaining: input.quantityRequested,
    status: "OPEN",
  });

  if (error) {
    return { error: error.message };
  }

  return {};
}
