/**
 * Placeholder Supabase schema types.
 *
 * Replace this file's contents with the real generated types once the
 * migrations in `supabase/migrations/` are applied to a live project:
 *
 *   supabase gen types typescript --project-id <ref> > lib/types/database.types.ts
 *
 * Keeping the same top-level shape (Tables/Views/Functions/Enums) means no
 * other file needs to change when the real generated types land (Phase 3).
 */
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      // Manually typed ahead of `supabase gen types` — see
      // supabase/migrations/0009_bootstrap_household.sql. Replace with the
      // real generated signature once types are regenerated in Phase 3.
      bootstrap_household: {
        Args: { p_household_name?: string };
        Returns: string; // uuid
      };
    };
    Enums: Record<string, never>;
  };
};
