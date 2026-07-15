# ai-service/ (FastAPI AI microservice)

Isolated Python FastAPI AI pipeline service, per
[`.cursor/plans/g-rocery-core.md`](../.cursor/plans/g-rocery-core.md) §3 and §5.

## Current state (Phase 4, partial)

- `pyproject.toml` (uv-managed) — `fastapi`, `uvicorn[standard]`, `pydantic-settings`, `httpx`; dev group has `pytest`/`ruff`/`mypy`. **Dependencies not yet installed** (`uv sync` intentionally not run).
- `app/core/config.py` — `Settings` (Pydantic Settings) binding the full env var matrix (§7), exposed via a cached `get_settings()` FastAPI dependency.
- `app/core/security.py` — `verify_service_token` dependency, constant-time comparison against `X-Service-Token`.
- `app/main.py` — FastAPI app instance + public `/health` liveness endpoint (deliberately does not depend on `Settings`, so it reports healthy before secrets are mounted).

## Still pending (rest of Phase 4, then Phase 5/6)

- `Dockerfile`, `app/api/v1/deps.py`, `app/clients/*`, `app/services/*`, `app/schemas/*`.
- `/api/process-receipt` + `/approve` + `/reject` routers (protected by `verify_service_token`), wired into `app/main.py` once the OCR (Phase 5) and Gemini (Phase 6) pipeline services exist.

## Local dev (once dependencies are installed)

```bash
uv sync
cp .env.example .env   # fill in Supabase, GCP Vision, Gemini, service token
uv run uvicorn app.main:app --reload --port 8000
curl http://localhost:8000/health
```
