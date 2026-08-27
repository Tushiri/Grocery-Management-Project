import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "@/lib/types/database.types";

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Server-side Supabase client for Server Components, Server Actions, and
 * Route Handlers (RLS-enforced via the anon key + the caller's session cookie).
 *
 * `cookies()` is async in the Next.js App Router — callers must `await` this.
 */
export async function supabaseServer(): Promise<TypedSupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // `setAll` was called from a Server Component — safe to ignore
            // because `middleware.ts` already refreshes the session cookie
            // on every request.
          }
        },
      },
    }
  ) as TypedSupabaseClient;
}
