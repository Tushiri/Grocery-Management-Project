"""FastAPI application entrypoint for the G-rocery AI microservice.

Isolated AI pipeline: Cloud Vision OCR + Gemini 2.5 Flash receipt processing.
See .cursor/plans/g-rocery-core.md §5 for the full service design.
"""

from fastapi import Depends, FastAPI
from pydantic import BaseModel

from app.core.security import verify_service_token

app = FastAPI(
    title="G-rocery AI Service",
    description="Isolated AI pipeline: Cloud Vision OCR + Gemini 2.5 Flash receipt processing.",
    version="0.1.0",
)


class HealthResponse(BaseModel):
    status: str
    service: str


@app.get("/health", response_model=HealthResponse, tags=["ops"])
async def health_check() -> HealthResponse:
    """Liveness probe — intentionally public (no X-Service-Token required).

    Deliberately does not depend on `Settings`/`get_settings` so the
    container reports healthy even before secrets (Supabase, Gemini, Vision,
    service token) are mounted — required for Cloud Run cold-start /
    readiness probes to pass before the rest of the config is wired up.
    """
    return HealthResponse(status="ok", service="ai-service")


class PingResponse(BaseModel):
    status: str


@app.get(
    "/api/ping",
    response_model=PingResponse,
    tags=["ops"],
    dependencies=[Depends(verify_service_token)],
)
async def ping() -> PingResponse:
    """Phase 4 smoke-test endpoint: proves `verify_service_token` rejects
    unauthenticated callers (401) and accepts a valid X-Service-Token.

    Temporary — superseded by the real protected routes
    (/api/process-receipt and friends) in Phase 5/6, at which point this
    endpoint should be removed.
    """
    return PingResponse(status="authenticated")


# NOTE: /api/process-receipt and /api/process-receipt/{id}/approve|reject
# routers (protected by `verify_service_token`) are wired in Phase 5/6 once
# the OCR + Gemini pipeline services exist — see g-rocery-core.md §5.5.
