import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { supabaseServer } from "@/lib/supabase/server";

/**
 * Server-side auth guard for all `(dashboard)` routes. Unauthenticated
 * sessions are redirected to `/login` before any child page renders.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  return <>{children}</>;
}
