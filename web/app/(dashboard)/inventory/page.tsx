/**
 * Placeholder inventory boundary (Server Component). Not yet wired to
 * `supabaseServer()` — CRUD + Realtime land in Phase 3 once auth/household
 * bootstrap (Phase 2) exists, since every query here is household-scoped
 * via RLS (`is_household_member`, see .cursor/plans/g-rocery-core.md §4.3).
 */
export default async function InventoryPage() {
  // TODO(Phase 3): const supabase = await supabaseServer();
  // TODO(Phase 3): const { data: items } = await supabase.from("inventory_items").select("*");

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Inventory</h1>
      <p className="mt-4 text-gray-500">No items yet.</p>
    </main>
  );
}
