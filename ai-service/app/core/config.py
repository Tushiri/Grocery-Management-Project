"""Typed environment configuration for the AI microservice.

See .cursor/plans/g-rocery-core.md §7 (Environment Variables Matrix) for the
full list of variables and which service/host each one belongs to.
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Required secrets/config, loaded from the process environment or `.env`.

    All fields are required (no defaults) by design: a missing secret should
    fail fast and loudly at the point of use, not silently fall back to an
    empty string. See app/main.py for why `/health` deliberately avoids
    depending on this class.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    supabase_url: str = Field(..., description="Supabase project URL")
    supabase_service_role_key: str = Field(
        ..., description="Service role key — bypasses RLS for trusted backend writes"
    )
    gcp_vision_credentials_json: str = Field(
        ..., description="Service account credentials for Google Cloud Vision"
    )
    gemini_api_key: str = Field(..., description="Google AI Studio key for Gemini 2.5 Flash")
    ai_service_token: str = Field(
        ..., description="Shared secret validated against the X-Service-Token header"
    )


@lru_cache
def get_settings() -> Settings:
    """Process-wide cached settings singleton.

    Exposed as a FastAPI dependency (rather than a module-level constant) so
    tests can override it via `app.dependency_overrides[get_settings]`.
    """
    return Settings()
