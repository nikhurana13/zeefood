"""
ZEfood Backend — Analytics Router
Demand forecasting, sentiment trends, and order statistics for the admin dashboard
"""
from fastapi import APIRouter, Depends
from app.models.schemas import DemandForecast, SentimentTrend, OrderStats
from app.services.firebase import get_user_db, get_admin_db, collection_to_list
from app.services.demand_predict import demand_predictor
from app.middleware.auth_middleware import require_owner, require_any_staff
from datetime import datetime, timezone
import logging

router = APIRouter(prefix="/analytics", tags=["Analytics"])
logger = logging.getLogger(__name__)


@router.get("/demand/{restaurant_id}", response_model=DemandForecast)
async def get_demand_forecast(
    restaurant_id: str,
    horizon_hours: int = 24,
    user: dict = Depends(require_any_staff()),
):
    """
    Get AI demand forecast for the next N hours.
    Available to both staff (for their restaurant) and owners.
    """
    db = get_user_db()
    # Load recent order history (last 90 days only — requires composite index:
    # orders: restaurant_id ASC, status ASC, created_at ASC)
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    try:
        orders_query = (
            db.collection("orders")
            .where("restaurant_id", "==", restaurant_id)
            .where("status", "==", "delivered")
            .where("created_at", ">=", cutoff)  # Apply cutoff — was computed but never used before
        )
        historical_orders = collection_to_list(orders_query)
    except Exception:
        historical_orders = []

    forecast = demand_predictor.predict_demand(
        restaurant_id=restaurant_id,
        historical_orders=historical_orders,
        horizon_hours=horizon_hours,
    )

    # Store alert in staff notifications if peak upcoming
    if forecast.get("alert_message"):
        _push_staff_alert(restaurant_id, forecast["alert_message"])

    return DemandForecast(**forecast)


@router.get("/sentiment-trends/{restaurant_id}", response_model=list[SentimentTrend])
async def get_sentiment_trends(
    restaurant_id: str,
    months: int = 3,
    user: dict = Depends(require_owner()),
):
    """Aggregated emotion/sentiment trends per restaurant for the admin panel."""
    db = get_user_db()
    try:
        reviews = collection_to_list(
            db.collection("reviews").where("restaurant_id", "==", restaurant_id)
        )
    except Exception:
        reviews = []

    # Group by month
    monthly: dict = {}
    for review in reviews:
        ts = review.get("created_at")
        if isinstance(ts, datetime):
            key = ts.strftime("%Y-%m")
        else:
            key = datetime.now().strftime("%Y-%m")

        if key not in monthly:
            monthly[key] = {"emotions": {}, "ratings": [], "texts": []}

        emotion = review.get("combined_emotion", "neutral")
        monthly[key]["emotions"][emotion] = monthly[key]["emotions"].get(emotion, 0) + 1
        if review.get("rating"):
            monthly[key]["ratings"].append(review["rating"])
        if review.get("text_content"):
            monthly[key]["texts"].append(review["text_content"])

    result = []
    for period, data in sorted(monthly.items(), reverse=True)[:months]:
        total = sum(data["emotions"].values()) or 1
        breakdown = {k: round(v / total, 3) for k, v in data["emotions"].items()}
        avg_rating = round(sum(data["ratings"]) / len(data["ratings"]), 2) if data["ratings"] else 0.0
        result.append(SentimentTrend(
            restaurant_id=restaurant_id,
            period=period,
            emotion_breakdown=breakdown,
            avg_rating=avg_rating,
            total_reviews=total,
            top_complaint=_top_emotion_text(data["texts"], ["anger", "disgust", "sadness"]),
            top_praise=_top_emotion_text(data["texts"], ["joy", "surprise"]),
        ))

    return result


@router.get("/orders", response_model=OrderStats)
async def get_order_stats(
    restaurant_id: str = None,
    user: dict = Depends(require_owner()),
):
    """Aggregate order statistics for the admin dashboard."""
    db = get_user_db()
    query = db.collection("orders")
    if restaurant_id:
        query = query.where("restaurant_id", "==", restaurant_id)

    orders = collection_to_list(query)
    total = len(orders)
    delivered = sum(1 for o in orders if o.get("status") == "delivered")
    cancelled = sum(1 for o in orders if o.get("status") == "cancelled")
    revenue = sum(o.get("total_amount", 0) for o in orders if o.get("status") == "delivered")

    return OrderStats(
        restaurant_id=restaurant_id,
        total_orders=total,
        delivered=delivered,
        cancelled=cancelled,
        avg_preparation_time_minutes=None,
        revenue=round(revenue, 2),
    )


def _push_staff_alert(restaurant_id: str, message: str) -> None:
    """Push demand spike alert to all staff assigned to a restaurant."""
    try:
        from app.services.firebase import get_staff_db
        db = get_staff_db()
        staff_docs = db.collection("staff").where("restaurant_id", "==", restaurant_id).stream()
        for staff in staff_docs:
            db.collection("staff").document(staff.id).collection("alerts").add({
                "message": message,
                "type": "demand_spike",
                "created_at": datetime.now(timezone.utc),
                "read": False,
            })
    except Exception as e:
        logger.warning(f"Staff alert push failed: {e}")


def _top_emotion_text(texts: list[str], target_emotions: list[str]) -> str:
    """Return the shortest review text as a sample of the target emotion type."""
    if not texts:
        return ""
    sorted_texts = sorted(texts, key=len)
    return sorted_texts[0][:120] if sorted_texts else ""
