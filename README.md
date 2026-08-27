# G-rocery

**Smart Inventory & Procurement System** — a household-scoped grocery app that tracks pantry inventory, builds a to-buy list, and processes receipt photos with OCR + AI to restock automatically.

**Current version:** `0.5.0`  
**Status:** All 9 development phases are **code-complete**. What remains is **your** cloud setup, secrets, migrations against a live Supabase project, and deployment.

---

## What it does

| Feature | Description |
|---------|-------------|
| **Household accounts** | Shared pantry per household; RLS ensures members only see their own data |
| **Inventory** | Add items, deplete quantities, realtime updates across browsers |
| **To-buy list** | Manual entries + auto-created when high/medium priority items run low |
| **Receipt upload** | Photo → Supabase Storage → OCR (Cloud Vision) → line-item review |
| **Smart mapping** | Known OCR strings resolve via lookup; unknown lines use Gemini 2.5 Flash |
| **Reconciliation** | Approve a receipt → inventory increments, price history logged, to-buy partially fulfilled |
| **PWA** | Installable web app (manifest + service worker in production builds) |

---

## Architecture (high level)

```
Browser (Next.js PWA)
    │
    ├── Supabase Auth / Postgres / Storage / Realtime  (anon key, RLS)
    │
    └── Next.js route handlers  (server-only secrets)
            │
            └── FastAPI ai-service  (Cloud Run)
                    ├── Google Cloud Vision (OCR)
                    ├── Gemini 2.5 Flash (unmapped lines)
                    └── Supabase service role (trusted writes)
```

**Receipt flow:** upload image → `POST /api/receipts` → FastAPI processes OCR → you review line items → `POST /api/receipts/{id}/approve` → inventory and to-buy update.

Detailed diagrams and DDL live in [`.cursor/plans/g-rocery-core.md`](.cursor/plans/g-rocery-core.md).

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS, PWA (`@ducanh2912/next-pwa`) |
| Backend (AI) | Python 3.12+, FastAPI, uv |
| Database | Supabase (PostgreSQL 15+, Auth, Storage, Realtime) |
| OCR | Google Cloud Vision API |
| LLM fallback | Gemini 2.5 Flash (`google-genai`) |
| Testing | Vitest (web, 100% coverage gate), pytest (ai-service, 100% coverage gate) |
| Package managers | pnpm (web monorepo), uv (ai-service) |

---

## Prerequisites

Install these **before** you start:

| Tool | Version / notes |
|------|-----------------|
| **Node.js** | 20+ (22 LTS recommended) |
| **pnpm** | 9.x (`corepack enable && corepack prepare pnpm@9.0.0 --activate`) |
| **Python** | 3.12+ |
| **uv** | [Install uv](https://docs.astral.sh/uv/getting-started/installation/) for the AI service |
| **Supabase CLI** | For migrations and optional local stack — [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli) |
| **Docker** | Optional but recommended for building/running `ai-service` locally |
| **Google Cloud account** | Cloud Vision API + Cloud Run deployment |
| **Google AI Studio** | Gemini API key — [aistudio.google.com](https://aistudio.google.com) |
| **Vercel account** | For deploying the Next.js app (free tier works for demos) |

---

## Project structure

```
Grocery-Management-Project/
├── web/                    # Next.js frontend + API route handlers
├── ai-service/             # FastAPI OCR / Gemini / reconciliation microservice
├── supabase/migrations/    # PostgreSQL schema (0001–0010)
├── docs/testing/           # TDD & coverage policy
├── CHANGELOG.md            # Release history
└── .cursor/plans/          # Architecture plan (g-rocery-core.md)
```

---

## Local development

### 1. Clone and install dependencies

```bash
git clone <your-repo-url>
cd Grocery-Management-Project

# Web app
pnpm install

# AI service
cd ai-service && uv sync && cd ..
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Copy **Project URL**, **anon key**, and **service_role key** (Settings → API).
3. Link the CLI (from repo root):

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

4. Apply migrations:

```bash
supabase db push
```

> **Reminder:** Migrations exist in the repo but **do nothing until you run `supabase db push`** against your project. Migration `0010_increment_inventory_rpc.sql` adds the atomic `increment_inventory_quantity` RPC used by receipt approval — deploy it before running the ai-service in production.

### 3. Set up Google Cloud (OCR)

1. Create or select a GCP project.
2. Enable **Cloud Vision API**.
3. Create a service account with **Cloud Vision API User**.
4. Download the JSON key — you will paste it into `GCP_VISION_CREDENTIALS_JSON`.

### 4. Get a Gemini API key

1. Open [Google AI Studio](https://aistudio.google.com).
2. Create an API key for Gemini 2.5 Flash.
3. Store it as `GEMINI_API_KEY` (ai-service only — never in the browser).

### 5. Configure environment variables

**Web** — copy and fill in:

```bash
cp web/.env.example web/.env.local
```

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | RLS-enforced client key |
| `AI_SERVICE_URL` | Server only | e.g. `http://localhost:8000` locally |
| `AI_SERVICE_TOKEN` | Server only | Shared secret with ai-service |

**AI service** — copy and fill in:

```bash
cp ai-service/.env.example ai-service/.env
```

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Same Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS for trusted pipeline writes |
| `GCP_VISION_CREDENTIALS_JSON` | Full service account JSON (single line or file path per your config) |
| `GEMINI_API_KEY` | Gemini 2.5 Flash |
| `AI_SERVICE_TOKEN` | Must match the web app's token |

> **Reminder:** Use a **strong random string** for `AI_SERVICE_TOKEN` (e.g. `openssl rand -hex 32`). The same value must be set in both `web/.env.local` and `ai-service/.env`.

### 6. Run everything

**Terminal 1 — AI service:**

```bash
cd ai-service
uv run uvicorn app.main:app --reload --port 8000
```

Verify: `curl http://localhost:8000/health` → `{"status":"ok","service":"ai-service"}`

**Terminal 2 — Web app:**

```bash
pnpm dev:web
# or: cd web && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. First-time user flow

1. **Sign up** at `/signup` — creates auth user + household via `bootstrap_household` RPC.
2. **Inventory** at `/inventory` — add a few items manually.
3. **To-buy** at `/to-buy` — add or wait for auto-generated entries when stock is low.
4. **Receipts** at `/receipts` — upload a grocery receipt photo, review parsed lines, approve.

---

## Running tests

The project enforces **100% test coverage** on touched modules. Run these before every merge:

```bash
# Web — 137 tests, Vitest + coverage thresholds
cd web && pnpm test && pnpm type-check

# AI service — 73 tests, pytest + coverage gate
cd ai-service && ./scripts/run-tests.sh
```

Policy details: [`docs/testing/tdd-and-coverage.md`](docs/testing/tdd-and-coverage.md).

---

## Web routes & API

### Pages (auth required except login/signup)

| Route | Purpose |
|-------|---------|
| `/login`, `/signup` | Email/password auth |
| `/inventory` | Pantry CRUD + deplete |
| `/to-buy` | Shopping list with status filters |
| `/receipts` | Upload receipt photo |
| `/receipts/[id]` | Review OCR results and approve |

### Next.js API (server)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/household/bootstrap` | Idempotent household creation after login |
| `POST /api/receipts` | Insert `pending_receipt`, call FastAPI process |
| `POST /api/receipts/[id]/approve` | Proxy approval to FastAPI reconciliation |

### FastAPI (ai-service, `X-Service-Token` required)

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness probe (public) |
| `POST /api/process-receipt` | OCR + lookup + Gemini fallback |
| `POST /api/process-receipt/{id}/approve` | Inventory + price history + to-buy updates |
| `POST /api/process-receipt/{id}/reject` | Mark receipt rejected (no inventory changes) |

---

## Production deployment

Code is ready; **deployment is manual**. Follow this checklist when you go live.

### Deploy web → Vercel

1. Import the repo; set **Root Directory** to `web`.
2. Add environment variables (same as `.env.local`, but use production URLs):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `AI_SERVICE_URL` → your Cloud Run URL
   - `AI_SERVICE_TOKEN`
3. Deploy. Run `pnpm build` locally first if you want to sanity-check.

### Deploy ai-service → Cloud Run

```bash
docker build -t ai-service ./ai-service
# Push to Artifact Registry, then:
gcloud run deploy ai-service \
  --image <your-image> \
  --port 8000 \
  --set-env-vars SUPABASE_URL=...,SUPABASE_SERVICE_ROLE_KEY=...,GEMINI_API_KEY=...,AI_SERVICE_TOKEN=...
# GCP_VISION_CREDENTIALS_JSON: use Secret Manager or mount as env
```

See [`ai-service/README.md`](ai-service/README.md) for Docker details.

### Post-deploy verification

- [ ] Sign up / login works on production URL
- [ ] Upload a **real receipt photo** end-to-end
- [ ] After approval, inventory and to-buy update without manual refresh (Realtime)
- [ ] Run **Lighthouse PWA** audit — installability should pass
- [ ] Confirm client bundle has **no secret values** (only env var names in server chunks is OK)

---

## Your checklist — things still on you

Everything below is **intentionally outside the codebase**. Tick these off to call the project fully operational in production.

### Cloud & accounts (one-time)

- [ ] **Supabase project** created and linked (`supabase link`)
- [ ] **Migrations applied** (`supabase db push`) — without this, nothing works
- [ ] **GCP project** with Vision API enabled + service account JSON
- [ ] **Gemini API key** from Google AI Studio
- [ ] **Vercel** project connected to `web/`
- [ ] **Cloud Run** service deployed for `ai-service/`

### Secrets & env (one-time per environment)

- [ ] `web/.env.local` filled for local dev
- [ ] `ai-service/.env` filled for local dev
- [ ] **Same** `AI_SERVICE_TOKEN` in web and ai-service
- [ ] Vercel env vars set for production
- [ ] Cloud Run env vars / Secret Manager set for production
- [ ] **Never commit** `.env`, `.env.local`, or GCP JSON keys to git

### Not yet implemented in code (optional follow-ups)

- [ ] **FastAPI CORS** restricted to your Vercel domain (add middleware + `ALLOWED_ORIGINS` env when deploying)
- [ ] **Reject receipt UI** in the web app (FastAPI reject endpoint exists; web only has approve today)
- [ ] **Navigation bar** linking Inventory / To-buy / Receipts (pages exist; you navigate by URL)
- [ ] **Admin tooling** — merge duplicate inventory items, bulk-edit product mappings
- [ ] **CI pipeline** (GitHub Actions) running `pnpm test` + `./scripts/run-tests.sh` on every PR
- [ ] Regenerate **`database.types.ts`** with `supabase gen types typescript` after schema changes (currently hand-maintained)

### Manual testing you should do once

- [ ] Full receipt E2E with a real photo (not just unit tests)
- [ ] Partial to-buy fulfillment: request qty 3, approve receipt qty 1 → status `PARTIAL`, row not deleted
- [ ] Second household / user — confirm RLS blocks cross-household access
- [ ] PWA install on phone (Add to Home Screen)

---

## Security reminders

| Rule | Why |
|------|-----|
| **Never** put `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, or `AI_SERVICE_TOKEN` in client code or `NEXT_PUBLIC_*` vars | Browser bundle is public |
| Receipt storage paths must be `{household_id}/{uuid}.ext` | Required by RLS policies |
| FastAPI is **never** called directly from the browser | All AI calls go through Next.js route handlers |
| Use `httpOnly` session cookies via Supabase SSR | Already wired in `middleware.ts` |
| Rotate keys if they ever leak | Supabase + GCP + Gemini keys are full-access |

---

## Documentation index

| Document | Contents |
|----------|----------|
| [CHANGELOG.md](CHANGELOG.md) | Release notes by version |
| [.cursor/plans/g-rocery-core.md](.cursor/plans/g-rocery-core.md) | Full architecture, DDL, phased roadmap |
| [docs/testing/tdd-and-coverage.md](docs/testing/tdd-and-coverage.md) | TDD workflow and coverage gates |
| [web/README.md](web/README.md) | Web-specific notes |
| [ai-service/README.md](ai-service/README.md) | AI service local dev & Docker |

---

## Phase completion summary

| Phase | Scope | Code status |
|-------|-------|-------------|
| 0 | Monorepo scaffolding | Done |
| 1 | Database schema + RLS | Migrations in repo — **you apply them** |
| 2 | Auth + household bootstrap | Done |
| 3 | Inventory & to-buy + Realtime | Done |
| 4 | FastAPI skeleton + Docker | Done |
| 5 | OCR + lookup-first pipeline | Done |
| 6 | Gemini fallback for unmapped lines | Done |
| 7 | Reconciliation engine | Done |
| 8 | Receipt upload & review UI | Done |
| 9 | PWA + production build prep | Done — **deploy is manual** |

---

## License

Private project — add a license file if you plan to open-source.

---

## Quick commands cheat sheet

```bash
# Install
pnpm install && cd ai-service && uv sync

# Dev servers
pnpm dev:web                          # http://localhost:3000
cd ai-service && uv run uvicorn app.main:app --reload --port 8000

# Tests
cd web && pnpm test && pnpm type-check
cd ai-service && ./scripts/run-tests.sh

# Production build (web)
cd web && pnpm build

# Database
supabase link --project-ref <ref>
supabase db push
```

If you get stuck, start with **migrations + env vars** — most local issues trace back to one of those two.
