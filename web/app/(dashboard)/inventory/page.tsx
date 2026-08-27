import { InventoryTable } from "@/components/inventory/InventoryTable";
import { getHouseholdIdForUser } from "@/lib/household/get-household-id";
import { supabaseServer } from "@/lib/supabase/server";

export default async function InventoryPage() {
  const householdId = await getHouseholdIdForUser();
  const supabase = await supabaseServer();

  const { data: items } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("household_id", householdId)
    .order("standardized_name");

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Inventory</h1>
      <InventoryTable householdId={householdId} initialItems={items ?? []} />
    </main>
  );
}
