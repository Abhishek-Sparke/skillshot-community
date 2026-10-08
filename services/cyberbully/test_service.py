"""Unit tests for the Cyberbully FastAPI moderation service."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

# Set test environment variables before importing app
os.environ["CYBERBULLY_MOCK_MODEL"] = "1"
os.environ["CYBERBULLY_REVIEW_THRESHOLD"] = "0.50"
os.environ["CYBERBULLY_HIGH_CONFIDENCE_THRESHOLD"] = "0.90"

from app import app
from detector import CyberbullyDetectorService, ModelInferenceError, ModelNotReadyError


@pytest.fixture
def client():
    """Create a FastAPI test client with mock detector active."""
    with TestClient(app) as test_client:
        yield test_client


def test_health_check(client):
    """Health check returns status ok and model loaded status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "cyberbully"
    assert data["model_loaded"] is True


def test_safe_comment(client):
    """Safe comment returns safe label, low score, category null, and flagged false."""
    response = client.post("/moderate", json={"text": "Great work! I really like this."})
    assert response.status_code == 200
    data = response.json()
    assert data["label"] == "safe"
    assert data["flagged"] is False
    assert data["category"] is None
    assert data["score"] < 0.50


def test_cyberbullying_comment(client):
    """Cyberbullying comment returns cyberbullying label, category, and flagged true."""
    response = client.post("/moderate", json={"text": "Nobody likes you, you are a loser."})
    assert response.status_code == 200
    data = response.json()
    assert data["label"] == "cyberbullying"
    assert data["flagged"] is True
    assert data["category"] == "targeted_insult_general"
    assert data["score"] >= 0.50


def test_high_confidence_harmful_comment(client):
    """High confidence harmful comment returns cyberbullying label with high score >= 0.90."""
    response = client.post("/moderate", json={"text": "Nobody likes you, you are pathetic."})
    assert response.status_code == 200
    data = response.json()
    assert data["label"] == "cyberbullying"
    assert data["flagged"] is True
    assert data["category"] == "targeted_insult_general"
    assert data["score"] >= 0.90


def test_empty_text_returns_bad_request(client):
    """Empty or whitespace-only text returns 400 Bad Request."""
    response = client.post("/moderate", json={"text": "   "})
    assert response.status_code == 400
    assert "Text cannot be empty" in response.text

    response_empty = client.post("/moderate", json={"text": ""})
    assert response_empty.status_code == 400


def test_long_text_handled_safely(client):
    """Long text is bounded and handled safely without crash."""
    long_safe_text = "This is a great skillshot! " * 150  # ~4000 characters
    response = client.post("/moderate", json={"text": long_safe_text})
    assert response.status_code == 200
    data = response.json()
    assert data["flagged"] is False


def test_service_token_authentication():
    """When CYBERBULLY_SERVICE_TOKEN is set, requests without valid token are rejected."""
    token = "secret-token-12345"
    with patch.dict(os.environ, {"CYBERBULLY_SERVICE_TOKEN": token}):
        with TestClient(app) as auth_client:
            # Missing header -> 401
            resp_no_token = auth_client.post("/moderate", json={"text": "Hello world"})
            assert resp_no_token.status_code == 401

            # Wrong token -> 401
            resp_wrong_token = auth_client.post(
                "/moderate",
                json={"text": "Hello world"},
                headers={"Authorization": "Bearer wrong-token"},
            )
            assert resp_wrong_token.status_code == 401

            # Correct token -> 200
            resp_ok = auth_client.post(
                "/moderate",
                json={"text": "Hello world"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp_ok.status_code == 200


def test_model_not_ready_returns_503(client):
    """When detector is not loaded, 503 Service Unavailable is returned."""
    with patch("app.detector_service.is_loaded", False):
        with patch("app.detector_service.predict", side_effect=ModelNotReadyError("Model not loaded")):
            response = client.post("/moderate", json={"text": "Test text"})
            assert response.status_code == 503
            assert "temporarily unavailable" in response.text


def test_inference_error_returns_503(client):
    """When model inference fails unexpectedly, 503 is returned."""
    with patch("app.detector_service.predict", side_effect=ModelInferenceError("CUDA error")):
        response = client.post("/moderate", json={"text": "Test text"})
        assert response.status_code == 503
        assert "inference failed" in response.text
