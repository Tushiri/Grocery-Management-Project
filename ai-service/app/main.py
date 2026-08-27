"""FastAPI application entrypoint for the G-rocery AI microservice.

Isolated AI pipeline: Cloud Vision OCR + Gemini 2.5 Flash receipt processing.
See .cursor/plans/g-rocery-core.md §5 for the full service design.
"""

from fastapi import FastAPI
from pydantic import BaseModel

from app.api.v1.routes_receipt import router as receipt_router

app = FastAPI(
    title="G-rocery AI Service",
    description="Isolated AI pipeline: Cloud Vision OCR + Gemini 2.5 Flash receipt processing.",
    version="0.2.0",
)

app.include_router(receipt_router)


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
