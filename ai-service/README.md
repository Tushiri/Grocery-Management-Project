# ai-service/ (FastAPI AI microservice)

Isolated Python FastAPI AI pipeline service, per
[`.cursor/plans/g-rocery-core.md`](../.cursor/plans/g-rocery-core.md) §3 and §5.

## Current state (Phase 4 + 5)

- `Dockerfile` — Cloud Run-ready multi-stage build (`ghcr.io/astral-sh/uv`), exposes port 8000
- `app/core/config.py` — `Settings` (Pydantic Settings) binding the full env var matrix (§7)
- `app/core/security.py` — `verify_service_token` dependency
- `app/main.py` — FastAPI app + public `/health` + protected `POST /api/process-receipt`
- `app/clients/` — Supabase (service role) and Google Cloud Vision clients
- `app/services/` — OCR, product mapping lookup, receipt pipeline
- pytest suite with **100%** coverage gate on `app/` (`./scripts/run-tests.sh`)

## Local dev

```bash
uv sync
cp .env.example .env   # fill in Supabase, GCP Vision, Gemini, service token
uv run uvicorn app.main:app --reload --port 8000
curl http://localhost:8000/health
```

## Docker (Cloud Run parity)

```bash
docker build -t ai-service ./ai-service
docker run --rm -p 8000:8000 \
  -e SUPABASE_URL=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e GCP_VISION_CREDENTIALS_JSON='...' \
  -e GEMINI_API_KEY=... \
  -e AI_SERVICE_TOKEN=... \
  ai-service
curl http://localhost:8000/health
```

## Tests

```bash
./scripts/run-tests.sh
```
