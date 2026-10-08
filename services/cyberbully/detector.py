"""Cyberbully detection engine wrapper for Skillshot AI moderation.

Integrates the open-source 'cyberbully' package (KEA-Mindz/Cyberbully)
using a reusable detector instance with fallback and error handling.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any, Optional

logger = logging.getLogger("cyberbully.detector")

# Default thresholds
DEFAULT_REVIEW_THRESHOLD = float(os.environ.get("CYBERBULLY_REVIEW_THRESHOLD", "0.50"))
DEFAULT_HIGH_CONFIDENCE_THRESHOLD = float(os.environ.get("CYBERBULLY_HIGH_CONFIDENCE_THRESHOLD", "0.90"))
MAX_TEXT_LENGTH = 5000


class ModelNotReadyError(Exception):
    """Raised when moderation is requested but the underlying model failed to load."""
    pass


class ModelInferenceError(Exception):
    """Raised when an inference error occurs during classification."""
    pass


class CyberbullyDetectorService:
    """Singleton-style wrapper managing the CyberbullyingDetector lifecycle."""

    def __init__(self, model_dir: Optional[str] = None, auto_load: bool = True):
        self.model_dir = model_dir or os.environ.get("CYBERBULLY_MODEL_DIR")
        self.detector = None
        self.is_loaded = False
        self.load_error: Optional[str] = None
        
        if auto_load:
            self.load()

    def load(self) -> bool:
        """Load the CyberbullyingDetector model into memory."""
        # Check mock/testing override
        if os.environ.get("CYBERBULLY_MOCK_MODEL", "").lower() in ("1", "true", "yes"):
            logger.info("Initializing Cyberbully detector in mock/test mode.")
            self.is_loaded = True
            self.load_error = None
            return True

        try:
            from cyberbully import CyberbullyingDetector
            logger.info("Initializing reusable CyberbullyingDetector instance...")
            self.detector = CyberbullyingDetector(
                model_dir=self.model_dir,
                auto_download=True,
            )
            self.is_loaded = True
            self.load_error = None
            logger.info("CyberbullyingDetector model loaded successfully.")
            return True
        except Exception as exc:
            msg = f"Failed to load CyberbullyingDetector: {exc}"
            logger.error(msg)
            self.detector = None
            self.is_loaded = False
            self.load_error = msg
            return False

    def predict(self, text: str, threshold: Optional[float] = None) -> dict[str, Any]:
        """Classify input text using the loaded detector.

        Args:
            text: Input string to moderate.
            threshold: Optional threshold override for flagging.

        Returns:
            Dict containing 'label', 'score', 'category', and 'flagged'.
        """
        if not self.is_loaded:
            raise ModelNotReadyError(self.load_error or "Cyberbully detector is not loaded.")

        clean_text = text.strip()
        if not clean_text:
            raise ValueError("Text cannot be empty.")

        # Bound length safely
        if len(clean_text) > MAX_TEXT_LENGTH:
            clean_text = clean_text[:MAX_TEXT_LENGTH]

        thr = threshold if threshold is not None else DEFAULT_REVIEW_THRESHOLD

        # If mock mode active:
        if os.environ.get("CYBERBULLY_MOCK_MODEL", "").lower() in ("1", "true", "yes") or self.detector is None:
            return self._heuristic_predict(clean_text, thr)

        try:
            result = self.detector.predict(clean_text)
            raw_score = float(getattr(result, "score", 0.0))
            category = getattr(result, "category", None)
            is_cyberbullying = bool(getattr(result, "is_cyberbullying", False))

            flagged = bool(raw_score >= thr or is_cyberbullying)
            score = round(raw_score, 4)

            if flagged:
                label = "cyberbullying"
                cat = category or "targeted_insult_general"
            else:
                label = "safe"
                cat = None

            return {
                "label": label,
                "score": score,
                "category": cat,
                "flagged": flagged,
            }
        except Exception as exc:
            logger.error(f"Inference error during cyberbullying detection: {exc}")
            raise ModelInferenceError(f"Detection inference failed: {exc}") from exc

    def _heuristic_predict(self, text: str, threshold: float) -> dict[str, Any]:
        """Rule-based predictor used for testing and deterministic validation."""
        lower = text.lower()

        # High-confidence patterns
        high_confidence = [
            "nobody likes you, you are pathetic",
            "kill yourself",
            "die in a hole",
            "pathetic loser",
            "you are disgusting trash",
            "you ugly piece of garbage",
        ]
        # Borderline / review patterns
        review_patterns = [
            "nobody likes you",
            "pathetic",
            "you are a loser",
            "loser",
            "shut up idiot",
            "idiot",
            "ugly and stupid",
            "trash player",
            "uninstall the game you clown",
        ]

        if any(p in lower for p in high_confidence):
            score = 0.99
            category = "targeted_insult_general"
            flagged = True
            label = "cyberbullying"
        elif any(p in lower for p in review_patterns):
            score = 0.75
            category = "targeted_insult_general"
            flagged = True
            label = "cyberbullying"
        else:
            score = 0.01
            category = None
            flagged = False
            label = "safe"

        flagged = bool(score >= threshold)
        if not flagged:
            label = "safe"
            category = None

        return {
            "label": label,
            "score": score,
            "category": category,
            "flagged": flagged,
        }


# Global detector instance
detector_service = CyberbullyDetectorService(auto_load=True)
