import { ToBuyList } from "@/components/to-buy/ToBuyList";
import { getHouseholdIdForUser } from "@/lib/household/get-household-id";
import { supabaseServer } from "@/lib/supabase/server";

export default async function ToBuyPage() {
  const householdId = await getHouseholdIdForUser();
  const supabase = await supabaseServer();

  const [{ data: entries }, { data: inventoryItems }] = await Promise.all([
    supabase
      .from("to_buy_list")
      .select("*, inventory_items(standardized_name, unit_type)")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false }),
    supabase
      .from("inventory_items")
      .select("*")
      .eq("household_id", householdId)
      .order("standardized_name"),
  ]);

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">To Buy</h1>
      <ToBuyList
        householdId={householdId}
        initialEntries={entries ?? []}
        inventoryItems={inventoryItems ?? []}
      />
    </main>
  );
}
