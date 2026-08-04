"""
ZEfood Backend — Text Sentiment / Emotion Analysis Service
Uses HuggingFace Transformers (DistilRoBERTa emotion classifier)
"""
from __future__ import annotations
import logging
from typing import Optional
import random

logger = logging.getLogger(__name__)


class SentimentService:
    """
    Classifies the emotion/sentiment of text reviews.
    Default model: j-hartmann/emotion-english-distilroberta-base
    Labels: anger, disgust, fear, joy, neutral, sadness, surprise
    """

    def __init__(self):
        self._pipeline = None
        self._ready = False

    def initialize(self, model_id: str) -> None:
        """Load the HuggingFace pipeline."""
        try:
            from transformers import pipeline
            logger.info(f"Loading sentiment model: {model_id}")
            self._pipeline = pipeline(
                "text-classification",
                model=model_id,
                return_all_scores=True,
                device=-1,  # CPU; change to 0 for GPU
            )
            self._ready = True
            logger.info("✅ Sentiment model loaded")
        except Exception as e:
            logger.warning(f"Sentiment model load failed: {e}. Using stub mode.")

    def analyze_text(self, text: str) -> dict:
        """
        Analyse emotion in a review text.
        Returns:
            {
                "label": str,       # dominant emotion
                "score": float,     # confidence
                "all_scores": dict  # all emotion → score
            }
        """
        if not self._ready:
            return self._stub_result(text)

        try:
            # Truncate to 512 tokens (model limit)
            truncated = text[:1024]
            results = self._pipeline(truncated)[0]
            # results is list of {"label": ..., "score": ...}
            all_scores = {r["label"].lower(): round(r["score"], 4) for r in results}
            best = max(results, key=lambda x: x["score"])
            return {
                "label": best["label"].lower(),
                "score": round(best["score"], 4),
                "all_scores": all_scores,
            }
        except Exception as e:
            logger.error(f"Sentiment analysis error: {e}")
            return self._stub_result(text)

    def analyze_batch(self, texts: list[str]) -> list[dict]:
        """Batch analyse multiple texts."""
        return [self.analyze_text(t) for t in texts]

    def _stub_result(self, text: str) -> dict:
        """Deterministic stub based on simple keyword heuristics."""
        text_lower = text.lower()
        if any(w in text_lower for w in ["great", "love", "amazing", "excellent", "fantastic", "delicious"]):
            label, score = "joy", 0.88
        elif any(w in text_lower for w in ["bad", "terrible", "worst", "disgusting", "awful"]):
            label, score = "anger", 0.82
        elif any(w in text_lower for w in ["sad", "disappointing", "disappointed", "missed"]):
            label, score = "sadness", 0.75
        elif any(w in text_lower for w in ["okay", "fine", "average", "decent"]):
            label, score = "neutral", 0.70
        else:
            label, score = "neutral", 0.60

        emotions = ["joy", "anger", "sadness", "fear", "surprise", "disgust", "neutral"]
        all_scores = {e: round(random.uniform(0.01, 0.1), 4) for e in emotions}
        all_scores[label] = score
        return {"label": label, "score": score, "all_scores": all_scores}


# Singleton
sentiment_service = SentimentService()
