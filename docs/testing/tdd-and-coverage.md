# G-rocery — TDD & 100% Code Coverage Policy

This document is the **carry-over standard** for all current and future work on G-rocery. It complements the phased roadmap in [`.cursor/plans/g-rocery-core.md`](../../.cursor/plans/g-rocery-core.md).

---

## 1. Workflow — Red → Green → Refactor

Every behavior change follows strict TDD:

1. **Red** — Write a failing test that describes the desired behavior (happy path, errors, edge cases).
2. **Green** — Implement the smallest amount of production code to make the test pass.
3. **Refactor** — Clean up duplication while keeping all tests green and coverage at 100%.

Do **not** merge production code without matching tests.

---

## 2. Coverage requirement — 100%

| Service | Tool | Enforced threshold | Command |
|---------|------|--------------------|---------|
| `web/` (Next.js) | Vitest + `@vitest/coverage-v8` | **100%** lines, branches, functions, statements | `pnpm test` |
| `ai-service/` (FastAPI) | pytest + pytest-cov | **100%** line + branch coverage on `app/` | `./scripts/run-tests.sh` |

CI and local pre-merge checks **must pass** these commands. A drop below 100% is a merge blocker.

### What counts toward coverage

**`web/` — included**

- `app/**/*.{ts,tsx}` (pages, layouts, route handlers)
- `lib/**/*.ts` (shared utilities, Supabase clients, hooks)
- `middleware.ts`

**`web/` — excluded**

- `**/__tests__/**`
- `lib/types/**` (generated / placeholder type-only files)
- Config files (`tailwind.config.ts`, `vitest.config.ts`, `next.config.js`)

**`ai-service/` — included**

- All modules under `app/`

**`ai-service/` — excluded**

- `tests/` (test code itself)

---

## 3. Test organization

### Next.js (`web/`)

```
web/
├── app/
│   └── (feature)/
│       ├── page.tsx
│       └── __tests__/
│           └── page.test.tsx      # colocated with the feature
├── lib/
│   └── feature/
│       ├── helper.ts
│       └── __tests__/
│           └── helper.test.ts
└── __tests__/
    └── middleware.test.ts         # top-level modules
```

- Use **Vitest** + **Testing Library** + **user-event** for UI.
- Mock external I/O (`@/lib/supabase/*`, `fetch`, `next/navigation`) at module boundaries.
- Cover **every branch**: success, validation errors, network failures, auth failures.

### FastAPI (`ai-service/`)

```
ai-service/
├── app/
│   └── services/
│       └── receipt_pipeline.py
└── tests/
    ├── conftest.py                # shared fixtures (env, dependency overrides)
    ├── test_main.py
    └── test_receipt_pipeline.py
```

- Use **pytest** + **pytest-asyncio** for async code.
- Use **httpx TestClient** (via `fastapi.testclient`) for HTTP endpoints.
- Override `get_settings` via `app.dependency_overrides` when needed.
- Shared env fixtures live in `tests/conftest.py`.

---

## 4. Commands (run before every PR)

```bash
# Web — tests + 100% coverage gate + types
cd web && pnpm test && pnpm type-check

# AI service — tests + 100% coverage gate
cd ai-service && ./scripts/run-tests.sh
```

Optional watch mode during development:

```bash
cd web && pnpm test:watch
```

---

## 5. Adding new features (Phase 3+)

When implementing a new module (e.g. inventory CRUD, receipt upload, reconciliation):

1. Read the phase checklist in `g-rocery-core.md`.
2. **Write failing tests first** for every public function, route, hook, and UI interaction.
3. Implement production code until `pnpm test` / `./scripts/run-tests.sh` report **100%**.
4. Run `pnpm type-check` for TypeScript changes.
5. Do not add `# coverage: ignore` / `# pragma: no cover` except for genuinely unreachable defensive code — and document why in the PR.

---

## 6. Phase completion criteria (updated)

Each phase in `g-rocery-core.md` is **not complete** until:

- [ ] All phase deliverables are implemented
- [ ] `pnpm test` passes with **100%** web coverage
- [ ] `./scripts/run-tests.sh` passes with **100%** ai-service coverage (when that service changed)
- [ ] `pnpm type-check` passes with 0 errors
- [ ] Manual verification steps from the plan are documented as done

---

## 7. References

| Document | Purpose |
|----------|---------|
| `.cursor/plans/g-rocery-core.md` | Architecture, schema, phased roadmap |
| `web/vitest.config.ts` | Coverage include/exclude + thresholds |
| `ai-service/pyproject.toml` | pytest-cov config + `--cov-fail-under=100` |
| `.cursor/rules/quality-and-testing.mdc` | Org-wide testing principles (G-rocery overrides coverage to 100%) |
