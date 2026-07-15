# web/ (Next.js app)

Next.js + Tailwind (PWA-to-be) frontend, per
[`.cursor/plans/g-rocery-core.md`](../.cursor/plans/g-rocery-core.md) §3 and §6.

## Current state (Phase 2, partial)

- `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js` — declared, **dependencies not yet installed** (`pnpm install` intentionally not run).
- `lib/supabase/client.ts` / `server.ts` — browser + server Supabase clients (RLS-enforced).
- `middleware.ts` — session-refresh middleware.
- `lib/types/database.types.ts` — placeholder schema types; replace with `supabase gen types typescript` output once linked to a live project (Phase 3).
- `app/page.tsx`, `app/(auth)/login/page.tsx`, `app/(dashboard)/inventory/page.tsx` — placeholder page boundaries, not yet wired to Supabase auth/data.

## Still pending (rest of Phase 2/3)

- Signup page + household auto-bootstrap on first signup.
- Real auth wiring on the login form (`supabaseBrowser().auth.signInWithPassword`).
- Inventory/To-Buy CRUD + Realtime subscriptions.
- `supabase gen types typescript` run against a linked project.

## Local dev (once dependencies are installed)

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase URL/anon key, AI service URL/token
pnpm dev
```
