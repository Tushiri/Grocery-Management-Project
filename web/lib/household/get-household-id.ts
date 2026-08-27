import { supabaseServer } from "@/lib/supabase/server";

/** Returns the caller's household id or throws when unauthenticated / unassigned. */
export async function getHouseholdIdForUser(): Promise<string> {
  const supabase = await supabaseServer();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("Not authenticated");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.household_id) {
    throw new Error("No household membership found");
  }

  return membership.household_id;
}
