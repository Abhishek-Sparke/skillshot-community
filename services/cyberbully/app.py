"""FastAPI application for the Cyberbully AI moderation service.

Exposes:
- POST /moderate: Classify text for cyberbullying
- GET /health: Health check and model readiness probe
"""

from __future__ import annotations

import logging
import os
import secrets
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from detector import (
    ModelInferenceError,
    ModelNotReadyError,
    detector_service,
)

# Configure logging without leaking sensitive values
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cyberbully.api")

app = FastAPI(
    title="Skillshot Cyberbully Moderation Service",
    description="Internal AI-powered text moderation microservice using the Cyberbully package.",
    version="1.0.0",
)


class ModerateRequest(BaseModel):
    """Payload for text moderation classification."""
    text: str = Field(..., max_length=5000, description="Text content to moderate")


class ModerateResponse(BaseModel):
    """Response containing moderation classification result."""
    label: str = Field(..., description="'cyberbullying' or 'safe'")
    score: float = Field(..., ge=0.0, le=1.0, description="Confidence/probability score (0.0 to 1.0)")
    category: Optional[str] = Field(None, description="Specific category (e.g. targeted_insult_general) or null")
    flagged: bool = Field(..., description="Whether content exceeded review thresholds")


def verify_service_token(authorization: Optional[str] = Header(None)) -> None:
    """Validate Bearer token if CYBERBULLY_SERVICE_TOKEN is configured."""
    expected_token = os.environ.get("CYBERBULLY_SERVICE_TOKEN", "").strip()
    if not expected_token:
        # No token configured; internal service is open to local/internal network
        return

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Expected Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    provided_token = parts[1]
    if not secrets.compare_digest(provided_token, expected_token):
        logger.warning("Rejected unauthorized request to moderation service.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid service token",
            headers={"WWW-Authenticate": "Bearer"},
        )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Format request validation errors consistently without exposing sensitive internals."""
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": "VALIDATION_ERROR", "detail": "Invalid request payload or text format."},
    )


@app.get("/health")
async def health_check():
    """Health and model probe."""
    return {
        "status": "ok" if detector_service.is_loaded else "degraded",
        "service": "cyberbully",
        "model_loaded": detector_service.is_loaded,
        "error": detector_service.load_error if not detector_service.is_loaded else None,
    }


@app.post(
    "/moderate",
    response_model=ModerateResponse,
    dependencies=[Depends(verify_service_token)],
)
async def moderate_text(payload: ModerateRequest):
    """Classify input text using the Cyberbully model.

    Returns:
        JSON response with label, score, category, and flagged status.
    """
    raw_text = payload.text.strip()
    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text cannot be empty.",
        )

    try:
        threshold = float(os.environ.get("CYBERBULLY_REVIEW_THRESHOLD", "0.50"))
        result = detector_service.predict(raw_text, threshold=threshold)
        return ModerateResponse(**result)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )
    except ModelNotReadyError as err:
        logger.error(f"Moderation unavailable: {err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cyberbully moderation model is temporarily unavailable.",
        )
    except ModelInferenceError as err:
        logger.error(f"Moderation inference failed: {err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cyberbully inference failed.",
        )
    except Exception as exc:
        logger.error(f"Unexpected error in moderation handler: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal moderation service error.",
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("CYBERBULLY_PORT", "8001"))
    host = os.environ.get("CYBERBULLY_HOST", "127.0.0.1")
    uvicorn.run("app:app", host=host, port=port, reload=False)
