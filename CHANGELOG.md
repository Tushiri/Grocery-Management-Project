# Changelog

All notable changes to **G-rocery** (Smart Inventory & Procurement System) are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

No planned work — Phases 1–9 complete. Deployment to Vercel + Cloud Run is a manual follow-up.

---

## [0.5.0] - 2026-08-27

End-to-end receipt upload and review UI (Phase 8) and PWA production build prep (Phase 9).

### Added

#### Receipt upload & review (`web/`)

- **`ReceiptUploadForm`** — uploads receipt photos to Supabase Storage (`receipts/{householdId}/{uuid}.ext`), then calls `POST /api/receipts`
- **`ReceiptReviewForm`** — renders parsed OCR line items with editable quantity/unit price; submits approval payload
- **Pages** — `/receipts` (upload), `/receipts/[id]` (review)
- **Route handlers** — `POST /api/receipts` (insert `pending_receipt` + proxy to FastAPI `/api/process-receipt`), `POST /api/receipts/[id]/approve` (proxy to FastAPI approve)
- **`lib/ai-service-client.ts`** — server-only fetch wrapper with `X-Service-Token` and `X-Correlation-ID`
- **`lib/receipts/types.ts`** — TypeScript types mirroring ai-service receipt schemas

#### PWA (Phase 9)

- **`public/manifest.json`** — installable web app manifest with theme colors and icons
- **`@ducanh2912/next-pwa`** — service worker (disabled in development, active in production builds)
- **`next.config.js`** — PWA wrapper, `productionBrowserSourceMaps: false`
- **Root layout metadata** — manifest link, Apple web app, theme color

#### Testing

- **137 Vitest tests** (up from 93), all passing with **100%** coverage on `app/`, `components/`, and `lib/`

### Security

- `AI_SERVICE_TOKEN` and `AI_SERVICE_URL` remain server-only (route handlers + ai-service-client); browser uses anon Supabase key only
- Storage path prefix validated against caller's `household_id` before creating `pending_receipt`
- Production build verified: no embedded secret values (`service_role`, `GEMINI_API_KEY` values) in client bundles

### Changed

- Phases 8 and 9 marked **complete** in the core plan
- Web version `0.2.0` → `0.5.0`; monorepo root `0.4.0` → `0.5.0`

### Follow-ups (manual deployment)

- Deploy `web/` to Vercel and `ai-service/` to Cloud Run
- Set env vars on both platforms; add FastAPI CORS restricted to Vercel domain
- Run Lighthouse PWA audit against production URL

---

## [0.4.0] - 2026-08-27

Gemini 2.5 Flash structured extraction fallback for unmapped OCR lines (Phase 6) and reconciliation engine with approve/reject endpoints (Phase 7).

### Added

#### Gemini fallback (`ai-service/`)

- **`GeminiClient`** — wraps `google.genai.Client` with `response_schema` enforced structured JSON (`gemini-2.5-flash`)
- **`GeminiService.extract_structured()`** — validates OCR line extractions via Pydantic (`GeminiLineExtraction`); raises `GeminiExtractionError` on invalid responses
- **Unmapped-line path in `receipt_pipeline`** — lookup miss → Gemini → `resolve_or_create_item` → `persist_mapping`; increments `matched_via_gemini_count`
- **`ProductMappingService`** — `resolve_or_create_item`, `persist_mapping` (normalized `raw_ocr_string`)
- **Supabase repo methods** — `find_inventory_item_by_name`, `create_inventory_item`, `insert_product_mapping`

#### Reconciliation engine (`ai-service/`)

- **`ReconciliationService`** — `apply_line_item` (inventory increment, `price_history` insert, partial to-buy fulfillment), `approve_receipt`, `reject_receipt`
- **`POST /api/process-receipt/{id}/approve`** — applies line items, sets `pending_receipt.status=APPROVED`
- **`POST /api/process-receipt/{id}/reject`** — sets `pending_receipt.status=REJECTED` without inventory mutations
- **To-buy status transitions** — `OPEN` → `PARTIAL` → `FULFILLED`; rows never deleted on partial approval
- **Schemas** — `ApproveReceiptRequest`, `ApproveReceiptResponse`, `RejectReceiptResponse`, `GeminiLineExtraction`

#### Testing

- **73 pytest tests** (up from 31), all passing with **100%** coverage on `app/`

### Changed

- Unmapped OCR lines are no longer skipped — routed to Gemini with mapping persisted for future lookup-first resolution
- Runtime deps: `google-genai>=1.0.0`
- Phases 6 and 7 marked **complete** in the core plan

### Security

- Gemini API key and service-role Supabase remain server-only; approve/reject endpoints require `X-Service-Token`

---

## [0.3.0] - 2026-08-27

AI service Docker containerization and lookup-first receipt OCR pipeline (Phase 4 remainder + Phase 5).

### Added

#### AI service containerization (`ai-service/`)

- **`Dockerfile`** — multi-stage Cloud Run build using `ghcr.io/astral-sh/uv`, exposes port 8000, runs `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000`

#### OCR + lookup-first pipeline (`ai-service/`)

- **`POST /api/process-receipt`** — protected by `X-Service-Token`; downloads receipt image from Supabase Storage, runs Cloud Vision OCR, resolves lines via household-scoped `product_mapping` lookup
- **`normalize_ocr_string()`** — trim, uppercase, collapse whitespace before every lookup
- **Clients** — `SupabaseServiceClient` (service role, bypasses RLS) and `VisionClient` (Google Cloud Vision)
- **Services** — `OcrService`, `ProductMappingService`, `receipt_pipeline`
- **Schemas** — `ProcessReceiptRequest`, `ProcessReceiptResponse`, `ParsedReceipt`, `ReceiptLineItem`
- Unmapped OCR lines are **skipped** until Phase 6 Gemini fallback

#### Testing

- **31 pytest tests** (up from 11), all passing with **100%** coverage on `app/`

### Removed

- Temporary **`GET /api/ping`** smoke endpoint (superseded by `POST /api/process-receipt`)

### Changed

- Runtime deps: `google-cloud-vision`, `supabase` (supabase-py)
- Phases 4 and 5 marked **complete** in the core plan

### Security

- Receipt processing uses service-role Supabase key only inside `ai-service`; endpoint requires shared `X-Service-Token` — not callable from the browser

---

## [0.2.0] - 2026-08-27

Inventory and to-buy CRUD with Supabase Realtime, auto to-buy triggers, and full test coverage.

### Added

#### Database types (`web/lib/types/database.types.ts`)

- Full hand-maintained schema types for migrations `0001`–`0008` plus `bootstrap_household` (`0009`): `inventory_items`, `to_buy_list`, `household_members`, and enums `priority_level`, `to_buy_status`, `household_role`, `receipt_status`

#### Inventory & to-buy (web)

- **Inventory page** (`/inventory`) — server-loaded table with manual add form and **Deplete** button (decrements quantity)
- **To-buy page** (`/to-buy`) — list with manual add and status filters (`ALL`, `OPEN`, `PARTIAL`, `FULFILLED`)
- **Server actions** — `createInventoryItem`, `depleteInventoryItem`, `addToBuyListEntry`
- **Auto to-buy** — when a `HIGH` or `MEDIUM` priority item reaches quantity `0` or falls below `min_threshold`, an `OPEN` entry is created in `to_buy_list` (skips if an `OPEN`/`PARTIAL` entry already exists)
- **Realtime hooks** — `useRealtimeInventory` and `useToBuyList` subscribe to `postgres_changes` filtered by `household_id`
- **Shared lib** — `apply-realtime-event`, `auto-to-buy`, `get-household-id`

#### Testing

- **93 Vitest tests** (up from 29), all passing with **100%** coverage on `app/`, `lib/`, `components/`, and `middleware.ts`
- New suites: hook tests, inventory/to-buy page tests, server action tests, realtime event unit tests

### Changed

- `@supabase/ssr` upgraded to `^0.7.0` for compatibility with `@supabase/supabase-js` 2.110 generic typing
- Supabase browser/server clients export `TypedSupabaseClient` for correct Database inference
- Phase 3 marked **complete** in the core plan

### Security

- All inventory and to-buy mutations run through RLS-enforced server actions under the caller's session — no service-role key in the web app

---

## [0.1.0] - 2026-08-27

First working foundation: database schema, authentication, household bootstrap, test infrastructure, and a partial AI microservice skeleton.

### Added

#### Monorepo & documentation

- pnpm workspace with `web/` (Next.js) and `ai-service/` (FastAPI), managed independently via `uv`
- Core architecture plan at `.cursor/plans/g-rocery-core.md`
- TDD and **100% code coverage** policy at `docs/testing/tdd-and-coverage.md` — every future change must keep tests green and coverage at 100% on touched modules

#### Database (Supabase / PostgreSQL)

- Migrations `0001`–`0008`: households, household members, inventory items, product mapping, price history, pending receipts, to-buy list, and receipt storage bucket policies
- Migration `0009`: `bootstrap_household()` RPC — idempotent SECURITY DEFINER function that creates a household + `OWNER` membership for new users (required because RLS blocks direct inserts on first signup)
- Row Level Security on all tables, scoped by `is_household_member()` / `is_household_owner()`
- `storage_object_household_id()` helper so malformed storage paths are denied safely instead of crashing Postgres

#### Web app (`web/`)

- Next.js 15 App Router scaffold with Tailwind CSS
- **Login** (`/login`) — email/password via Supabase `signInWithPassword`, then household bootstrap, then redirect to `/inventory`
- **Signup** (`/signup`) — `signUp`, household bootstrap, redirect to `/inventory`
- **Dashboard guard** — `(dashboard)/layout.tsx` redirects unauthenticated users to `/login` before any protected page renders
- **Household bootstrap API** — `POST /api/household/bootstrap` calls the `bootstrap_household` RPC under the caller's session
- **Session middleware** — refreshes Supabase auth cookies on every request
- Supabase browser and server clients (`lib/supabase/client.ts`, `lib/supabase/server.ts`)
- Placeholder pages: home (`/`), inventory (`/inventory`)

#### AI microservice (`ai-service/`)

- FastAPI app with public `GET /health` liveness probe (works before secrets are mounted — needed for Cloud Run cold start)
- Protected `GET /api/ping` smoke-test endpoint (requires `X-Service-Token` header)
- Typed settings via Pydantic (`Settings` / `get_settings`) for all env vars in the plan's matrix
- `verify_service_token` dependency with constant-time token comparison

#### Testing

- **Web:** Vitest, Testing Library, user-event; 29 tests; **100%** coverage enforced on `app/`, `lib/`, and `middleware.ts` via `pnpm test`
- **AI service:** pytest, pytest-asyncio, pytest-cov; **100%** coverage enforced on `app/` via `./scripts/run-tests.sh`
- TypeScript strict check: `pnpm type-check`

### Changed

- Phase 2 marked **complete** in the core plan — signup, login, dashboard guard, and bootstrap flow are all wired
- `pnpm test` now runs with coverage thresholds; a drop below 100% fails the build

### Fixed

- **`verify_service_token` HTTP semantics** — a missing `X-Service-Token` header previously returned `422` (FastAPI validation) instead of `401`. Header is now optional at the framework layer with an explicit `None` check so missing and wrong tokens both return `401`.

### Security

- Household bootstrap uses a narrowly scoped RPC acting only on `auth.uid()` — no service-role key in the Next.js app
- Dashboard routes enforce auth server-side, not just by hiding navigation links
- AI service endpoints (except `/health`) require the shared service token; token comparison uses `secrets.compare_digest`

---

## How to read this log going forward

When you ship a meaningful chunk of work:

1. Move items from **[Unreleased]** into a new dated version section (newest version at the top, below Unreleased).
2. Group entries under **Added**, **Changed**, **Deprecated**, **Removed**, **Fixed**, or **Security** — write for a human, not as a git log dump ([Keep a Changelog guiding principles](https://keepachangelog.com/en/1.1.0/#how)).
3. Bump the version in root `package.json` when you cut a release (`0.2.0` for Phase 3, etc.).

**Quick “where am I?” checklist**

| Phase | Status in 0.1.0 |
|-------|-----------------|
| 0 — Scaffolding | Done |
| 1 — Database & RLS | Migrations written; apply with `supabase db push` against your project |
| 2 — Auth & bootstrap | Done |
| 3 — Inventory CRUD + Realtime | Done |
| 4 — FastAPI skeleton + Docker | Done |
| 5 — OCR + lookup-first pipeline | Done |
| 6 — Gemini fallback | Done |
| 7 — Reconciliation engine | Done |
| 8 — Receipt upload & review UI | Done |
| 9 — PWA & production build prep | Done (deploy to Vercel/Cloud Run is manual follow-up) |

```bash
cd web && pnpm test && pnpm type-check
cd ai-service && ./scripts/run-tests.sh
```
