"""
ZEfood Backend — Recommendations Router
AI-powered personalized restaurant and dish recommendations
"""
from fastapi import APIRouter, Depends
from app.models.schemas import RestaurantScore, DishScore
from app.services.firebase import get_user_db, collection_to_list
from app.services.recommender import recommender_service
from app.middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get("/restaurants", response_model=list[RestaurantScore])
async def get_restaurant_recommendations(
    limit: int = 10,
    user: dict = Depends(get_current_user),
):
    """Return personalized restaurant recommendations for the current user."""
    db = get_user_db()
    all_restaurants = collection_to_list(db.collection("restaurants").where("is_active", "==", True))

    # Record this browse event to improve recommendations
    recommender_service.record_interaction(user["uid"], "", "view")

    results = recommender_service.get_restaurant_recommendations(
        user_id=user["uid"],
        all_restaurants=all_restaurants,
        limit=limit,
    )

    return [
        RestaurantScore(
            restaurant_id=r.get("id", ""),
            name=r.get("name", ""),
            score=r.get("recommendation_score", 0.5),
            reason=r.get("reason"),
            image_url=r.get("image_url"),
        )
        for r in results
    ]


@router.get("/dishes/{restaurant_id}", response_model=list[DishScore])
async def get_dish_recommendations(
    restaurant_id: str,
    limit: int = 8,
    user: dict = Depends(get_current_user),
):
    """Return personalized dish recommendations within a restaurant."""
    db = get_user_db()
    items = collection_to_list(
        db.collection("restaurants").document(restaurant_id).collection("items")
        .where("is_available", "==", True)
    )

    results = recommender_service.get_dish_recommendations(
        user_id=user["uid"],
        restaurant_id=restaurant_id,
        all_items=items,
        limit=limit,
    )

    return [
        DishScore(
            item_id=r.get("id", ""),
            name=r.get("name", ""),
            restaurant_id=restaurant_id,
            score=r.get("recommendation_score", 0.5),
            emotion_tag=r.get("emotion_tag"),
        )
        for r in results
    ]
