"""
ZEfood Backend — Recommendation Engine
Hybrid collaborative filtering + sentiment-weighted scoring
"""
from __future__ import annotations
import logging
import math
from typing import Optional
from collections import defaultdict

logger = logging.getLogger(__name__)

# Emotion → numerical boost mapping
EMOTION_BOOST = {
    "joy": 1.2,
    "surprise": 1.1,
    "neutral": 1.0,
    "sadness": 0.8,
    "fear": 0.7,
    "disgust": 0.5,
    "anger": 0.4,
}


class RecommenderService:
    """
    Hybrid recommendation engine:
    1. Collaborative Filtering (implicit feedback from order history)
    2. Sentiment Boost (adjust scores based on emotional review signals)
    3. Content-Based fallback (cuisine tag similarity for cold-start)
    """

    def __init__(self):
        self._ready = False
        self._cf_model = None
        # In-memory training data cache (loaded from Firestore on startup)
        self._user_item_matrix = {}  # user_id → {restaurant_id: interaction_score}
        self._item_emotions = {}     # restaurant_id → {emotion: avg_score}

    def initialize(self) -> None:
        """
        In production this would load a pre-trained implicit CF model.
        For the scaffold we use pure in-memory computation.
        """
        self._ready = True
        logger.info("✅ Recommender service initialised (in-memory mode)")

    def record_interaction(self, user_id: str, restaurant_id: str,
                            interaction_type: str = "order") -> None:
        """Record a user-restaurant interaction (order/view/review)."""
        weights = {"order": 3.0, "review": 2.0, "view": 0.5}
        weight = weights.get(interaction_type, 1.0)
        if user_id not in self._user_item_matrix:
            self._user_item_matrix[user_id] = defaultdict(float)
        self._user_item_matrix[user_id][restaurant_id] += weight

    def record_emotion(self, restaurant_id: str, item_id: Optional[str],
                       emotion: str, score: float) -> None:
        """Record emotional review signal for a restaurant (and optionally item)."""
        key = item_id if item_id else restaurant_id
        if key not in self._item_emotions:
            self._item_emotions[key] = defaultdict(list)
        self._item_emotions[key][emotion].append(score)

    def get_restaurant_recommendations(
        self,
        user_id: str,
        all_restaurants: list[dict],
        limit: int = 10,
    ) -> list[dict]:
        """
        Return ranked restaurant recommendations for a user.
        Scoring = collaborative score × emotion boost × novelty bonus
        """
        if not all_restaurants:
            return []

        user_history = self._user_item_matrix.get(user_id, {})
        scored = []

        for restaurant in all_restaurants:
            rid = restaurant.get("id", "")
            cf_score = user_history.get(rid, 0.0)

            # Emotion boost
            em_data = self._item_emotions.get(rid, {})
            emotion_boost = self._compute_emotion_boost(em_data)

            # Base score from restaurant rating
            rating_score = restaurant.get("rating", 3.0) / 5.0

            # Novelty: boost unvisited restaurants for discovery
            novelty = 1.5 if rid not in user_history else 0.8

            # Find similar users who also ordered from this restaurant
            peer_score = self._peer_ordering_score(user_id, rid, user_history)

            final_score = (
                0.30 * rating_score +
                0.25 * min(cf_score / 10.0, 1.0) +   # normalised CF
                0.20 * emotion_boost +
                0.15 * peer_score +
                0.10 * (novelty - 1.0)
            )

            scored.append({
                **restaurant,
                "recommendation_score": round(final_score, 4),
                "reason": self._generate_reason(cf_score, emotion_boost, user_history, rid),
            })

        scored.sort(key=lambda x: x["recommendation_score"], reverse=True)
        return scored[:limit]

    def get_dish_recommendations(
        self,
        user_id: str,
        restaurant_id: str,
        all_items: list[dict],
        limit: int = 8,
    ) -> list[dict]:
        """Return ranked dish recommendations within a restaurant."""
        scored = []
        for item in all_items:
            if not item.get("is_available", True):
                continue
            iid = item.get("id", "")
            em_data = self._item_emotions.get(iid, {})
            emotion_boost = self._compute_emotion_boost(em_data)
            base = item.get("rating", 4.0) / 5.0 if item.get("rating") else 0.7
            final_score = 0.5 * base + 0.5 * emotion_boost
            dominant_emotion = self._dominant_emotion(em_data)
            scored.append({
                **item,
                "recommendation_score": round(final_score, 4),
                "emotion_tag": dominant_emotion,
            })
        scored.sort(key=lambda x: x["recommendation_score"], reverse=True)
        return scored[:limit]

    # ── Internal helpers ──────────────────────────────────

    def _compute_emotion_boost(self, em_data: dict) -> float:
        if not em_data:
            return 0.5  # neutral default
        total_weight, total_score = 0.0, 0.0
        for emotion, scores in em_data.items():
            boost = EMOTION_BOOST.get(emotion, 1.0)
            avg_score = sum(scores) / len(scores)
            total_weight += avg_score
            total_score += boost * avg_score
        return total_score / total_weight if total_weight else 0.5

    def _peer_ordering_score(self, user_id: str, restaurant_id: str,
                              user_history: dict) -> float:
        """Simple user-user CF: find users with similar history."""
        if not user_history:
            return 0.0
        peer_count = 0
        for other_uid, other_hist in self._user_item_matrix.items():
            if other_uid == user_id:
                continue
            shared = set(user_history) & set(other_hist)
            if shared and restaurant_id in other_hist:
                peer_count += 1
        return min(peer_count / 10.0, 1.0)

    def _dominant_emotion(self, em_data: dict) -> Optional[str]:
        if not em_data:
            return None
        best = max(em_data.items(), key=lambda kv: sum(kv[1]) / len(kv[1]))
        return best[0]

    def _generate_reason(self, cf_score: float, emotion_boost: float,
                          user_history: dict, restaurant_id: str) -> str:
        if cf_score > 5:
            return "You've ordered from here before"
        if emotion_boost > 1.1:
            return "Customers love this restaurant"
        if restaurant_id not in user_history:
            return "Discover something new"
        return "Recommended for you"


# Singleton
recommender_service = RecommenderService()
