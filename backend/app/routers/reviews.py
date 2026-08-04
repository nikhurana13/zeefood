"""
ZEfood Backend — Reviews Router
Text and audio review submission with AI sentiment/emotion analysis
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from app.models.schemas import (
    TextReviewCreate, ReviewResponse, ReviewType, MessageResponse
)
from app.services.firebase import get_user_db, upload_file_to_storage, doc_to_dict, collection_to_list
from app.services.sentiment import sentiment_service
from app.services.audio_emotion import audio_emotion_service
from app.services.recommender import recommender_service
from app.middleware.auth_middleware import get_current_user
import uuid
import logging
from datetime import datetime, timezone

router = APIRouter(prefix="/reviews", tags=["Reviews"])
logger = logging.getLogger(__name__)


def _combine_emotions(text_emotion: dict, audio_emotion: dict) -> str:
    """Combine text sentiment and audio emotion into a single label."""
    if not audio_emotion:
        return text_emotion.get("label", "neutral")
    # Average the two emotion signals — use text score as primary
    text_score = text_emotion.get("score", 0.5)
    audio_label = audio_emotion.get("emotion", "neutral")
    text_label = text_emotion.get("label", "neutral")
    # If both agree, return that; otherwise weight toward higher confidence
    if text_label == audio_label:
        return text_label
    if text_score >= 0.7:
        return text_label
    return audio_label


@router.post("/text", response_model=ReviewResponse, status_code=201)
async def submit_text_review(payload: TextReviewCreate, user: dict = Depends(get_current_user)):
    """Submit a text review. Triggers NLP sentiment analysis."""
    db = get_user_db()
    review_id = str(uuid.uuid4())

    # Run sentiment analysis
    sentiment_result = sentiment_service.analyze_text(payload.text)

    review_data = {
        "id": review_id,
        "user_id": user["uid"],
        "restaurant_id": payload.restaurant_id,
        "order_id": payload.order_id,
        "item_id": payload.item_id,
        "type": ReviewType.text.value,
        "text_content": payload.text,
        "rating": payload.rating,
        "sentiment": sentiment_result,
        "audio_emotion": None,
        "combined_emotion": sentiment_result.get("label", "neutral"),
        "created_at": datetime.now(timezone.utc),
    }

    db.collection("reviews").document(review_id).set(review_data)

    # Feed to recommender
    recommender_service.record_emotion(
        payload.restaurant_id,
        payload.item_id,
        sentiment_result.get("label", "neutral"),
        sentiment_result.get("score", 0.5),
    )

    # Update restaurant aggregate emotion scores
    _update_restaurant_emotion(db, payload.restaurant_id, sentiment_result)

    return ReviewResponse(**review_data)


@router.post("/audio", response_model=ReviewResponse, status_code=201)
async def submit_audio_review(
    restaurant_id: str = Form(...),
    order_id: str = Form(None),
    item_id: str = Form(None),
    rating: int = Form(default=4),
    audio_file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Submit an audio review. Runs Whisper STT + audio emotion analysis."""
    db = get_user_db()
    review_id = str(uuid.uuid4())

    # Read audio bytes
    audio_bytes = await audio_file.read()

    # Upload to Firebase Storage
    storage_path = f"reviews/audio/{user['uid']}/{review_id}{audio_file.filename}"
    try:
        audio_url = upload_file_to_storage(audio_bytes, storage_path, audio_file.content_type)
    except Exception as e:
        logger.warning(f"Storage upload failed: {e}")
        audio_url = None

    # Run audio emotion analysis
    audio_result = audio_emotion_service.analyze_audio(audio_bytes, audio_file.filename)

    # Also run text sentiment on transcript
    transcript = audio_result.get("transcript", "")
    text_sentiment = sentiment_service.analyze_text(transcript) if transcript else {"label": "neutral", "score": 0.5}

    combined = _combine_emotions(text_sentiment, audio_result)

    review_data = {
        "id": review_id,
        "user_id": user["uid"],
        "restaurant_id": restaurant_id,
        "order_id": order_id,
        "item_id": item_id,
        "type": ReviewType.audio.value,
        "text_content": transcript,
        "audio_url": audio_url,
        "rating": rating,
        "sentiment": text_sentiment,
        "audio_emotion": audio_result,
        "combined_emotion": combined,
        "created_at": datetime.now(timezone.utc),
    }

    db.collection("reviews").document(review_id).set(review_data)

    recommender_service.record_emotion(restaurant_id, item_id, combined, text_sentiment.get("score", 0.5))
    _update_restaurant_emotion(db, restaurant_id, {"label": combined, "score": text_sentiment.get("score", 0.5)})

    return ReviewResponse(**review_data)


@router.get("/{restaurant_id}", response_model=list[ReviewResponse])
async def get_restaurant_reviews(restaurant_id: str, limit: int = 20):
    """Get reviews for a restaurant, ordered by newest first."""
    db = get_user_db()
    query = (
        db.collection("reviews")
        .where("restaurant_id", "==", restaurant_id)
        .order_by("created_at", direction="DESCENDING")
        .limit(limit)
    )
    reviews = collection_to_list(query)
    return [ReviewResponse(**r) for r in reviews]


def _update_restaurant_emotion(db, restaurant_id: str, sentiment: dict) -> None:
    """Increment emotion score aggregation on the restaurant document.

    Uses firebase_admin.firestore.Increment for atomic server-side increments.
    """
    try:
        from firebase_admin import firestore as fb_firestore
        label = sentiment.get("label", "neutral")
        score = sentiment.get("score", 0.5)
        db.collection("restaurants").document(restaurant_id).set(
            {
                f"emotion_totals.{label}": fb_firestore.Increment(score),
                f"emotion_counts.{label}": fb_firestore.Increment(1),
            },
            merge=True,
        )
    except Exception as e:
        logger.warning(f"Emotion aggregation update failed: {e}")
