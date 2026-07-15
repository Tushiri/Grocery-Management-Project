import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

/**
 * Idempotent household bootstrap — call this after every successful login.
 *
 * Delegates to the `bootstrap_household` Postgres function (see
 * supabase/migrations/0009_bootstrap_household.sql) rather than inserting
 * directly: `households` has no client-facing INSERT policy, and the first
 * `household_members` row can't satisfy `is_household_owner()` (nothing to
 * own yet), so a plain RLS-scoped insert from this route would always be
 * rejected. The RPC is a SECURITY DEFINER function scoped to `auth.uid()`,
 * so it can safely bypass RLS for this one narrow operation.
 */
export async function POST() {
  const supabase = await supabaseServer();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: householdId, error: rpcError } = await supabase.rpc("bootstrap_household");
  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  return NextResponse.json({ householdId });
}
