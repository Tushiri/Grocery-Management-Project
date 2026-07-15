"""Service-to-service authentication for endpoints exposed only to trusted callers.

This microservice is never called directly from the browser — only from the
Next.js server (route handlers / server actions) which holds the same
AI_SERVICE_TOKEN secret. See .cursor/plans/g-rocery-core.md §5.5 / §7.
"""

import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.core.config import Settings, get_settings


async def verify_service_token(
    settings: Annotated[Settings, Depends(get_settings)],
    x_service_token: Annotated[str | None, Header(alias="X-Service-Token")] = None,
) -> None:
    """Reject any request that doesn't present the shared service secret.

    `x_service_token` is deliberately optional at the FastAPI/Pydantic layer
    (rather than required) so a *missing* header fails with the same 401 as a
    *wrong* one. Making it required would make FastAPI's own request
    validation reject missing headers with a 422 before this function body
    ever runs — leaking whether the header is absent vs. merely invalid.

    Uses `secrets.compare_digest` for a constant-time comparison so response
    timing can't be used to brute-force the token character-by-character.
    """
    if x_service_token is None or not secrets.compare_digest(
        x_service_token, settings.ai_service_token
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Service-Token",
        )
