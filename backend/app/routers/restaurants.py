"""
ZEfood Backend — Restaurants Router
CRUD operations for restaurant management.
This router was missing entirely — inventory and orders both reference restaurant IDs
but there was no way to create or list restaurants via the API.
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, status
from app.models.schemas import (
    RestaurantCreate, RestaurantResponse, MessageResponse, UserRole
)
from app.services.firebase import (
    get_user_db, get_admin_db, upload_file_to_storage,
    doc_to_dict, collection_to_list,
)
from app.middleware.auth_middleware import get_current_user, require_owner, require_admin
import uuid
import logging
from datetime import datetime, timezone

router = APIRouter(prefix="/restaurants", tags=["Restaurants"])
logger = logging.getLogger(__name__)


# ── Public Endpoints ──────────────────────────────────────

@router.get("/", response_model=list[RestaurantResponse])
async def list_restaurants(
    type_filter: str = None,
    cuisine: str = None,
    active_only: bool = True,
):
    """
    List all restaurants (public — no auth required).
    Optional filters: type (restaurant|hotel|mart), cuisine tag, active_only.

    Requires Firestore index: restaurants — is_active ASC, type ASC
    """
    db = get_user_db()
    query = db.collection("restaurants")

    if active_only:
        query = query.where("is_active", "==", True)
    if type_filter:
        query = query.where("type", "==", type_filter)

    restaurants = collection_to_list(query)

    # Apply cuisine filter in Python (avoids requiring extra composite index)
    if cuisine:
        cuisine_lower = cuisine.lower()
        restaurants = [
            r for r in restaurants
            if any(cuisine_lower in c.lower() for c in r.get("cuisine", []))
        ]

    return [RestaurantResponse(**r) for r in restaurants]


@router.get("/{restaurant_id}", response_model=RestaurantResponse)
async def get_restaurant(restaurant_id: str):
    """Get a single restaurant by ID (public)."""
    db = get_user_db()
    doc = db.collection("restaurants").document(restaurant_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return RestaurantResponse(**doc_to_dict(doc))


# ── Owner / Admin Endpoints ───────────────────────────────

@router.post("/", response_model=RestaurantResponse, status_code=status.HTTP_201_CREATED)
async def create_restaurant(
    payload: RestaurantCreate,
    user: dict = Depends(require_owner()),
):
    """
    Create a new restaurant (owner/super_admin only).
    The restaurant will be associated with the authenticated owner's UID.
    """
    db = get_user_db()
    restaurant_id = str(uuid.uuid4())

    restaurant_data = {
        "id": restaurant_id,
        "name": payload.name,
        "type": payload.type.value,
        "cuisine": payload.cuisine,
        "lat": payload.lat,
        "lng": payload.lng,
        "address": payload.address,
        "phone": payload.phone,
        "owner_id": user["uid"],   # Always tied to authenticated user, not payload
        "rating": 0.0,
        "total_reviews": 0,
        "image_url": None,
        "is_active": True,
        "emotion_summary": {},
        "emotion_totals": {},
        "emotion_counts": {},
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    db.collection("restaurants").document(restaurant_id).set(restaurant_data)

    # Also store a reference in the admin DB for owner dashboard
    try:
        admin_db = get_admin_db()
        admin_db.collection("restaurant_refs").document(restaurant_id).set({
            "restaurant_id": restaurant_id,
            "name": payload.name,
            "owner_id": user["uid"],
            "created_at": datetime.now(timezone.utc),
        })
    except Exception as e:
        logger.warning(f"Admin DB reference update failed: {e}")

    logger.info(f"Restaurant created: {payload.name} ({restaurant_id}) by {user['uid']}")
    return RestaurantResponse(**restaurant_data)


@router.patch("/{restaurant_id}", response_model=RestaurantResponse)
async def update_restaurant(
    restaurant_id: str,
    name: str = None,
    address: str = None,
    phone: str = None,
    cuisine: list[str] = None,
    is_active: bool = None,
    user: dict = Depends(require_owner()),
):
    """
    Update restaurant details (owner/super_admin only).
    Owners can only update their own restaurant; super_admin can update any.
    """
    db = get_user_db()
    ref = db.collection("restaurants").document(restaurant_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    existing = doc_to_dict(doc)

    # Owners can only edit their own restaurant
    if user.get("role") != "super_admin" and existing.get("owner_id") != user["uid"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own restaurant",
        )

    update_data: dict = {"updated_at": datetime.now(timezone.utc)}
    if name is not None:
        update_data["name"] = name
    if address is not None:
        update_data["address"] = address
    if phone is not None:
        update_data["phone"] = phone
    if cuisine is not None:
        update_data["cuisine"] = cuisine
    if is_active is not None:
        update_data["is_active"] = is_active

    if len(update_data) == 1:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    ref.update(update_data)
    return RestaurantResponse(**doc_to_dict(ref.get()))


@router.post("/{restaurant_id}/image")
async def upload_restaurant_image(
    restaurant_id: str,
    image: UploadFile = File(...),
    user: dict = Depends(require_owner()),
):
    """Upload a cover image for a restaurant."""
    db = get_user_db()
    doc = db.collection("restaurants").document(restaurant_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    if user.get("role") != "super_admin" and doc_to_dict(doc).get("owner_id") != user["uid"]:
        raise HTTPException(status_code=403, detail="Not your restaurant")

    image_bytes = await image.read()
    path = f"restaurants/{restaurant_id}/cover{image.filename}"
    try:
        url = upload_file_to_storage(image_bytes, path, image.content_type)
        db.collection("restaurants").document(restaurant_id).update({"image_url": url})
        return {"image_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image upload failed: {e}")


@router.delete("/{restaurant_id}", response_model=MessageResponse)
async def delete_restaurant(
    restaurant_id: str,
    user: dict = Depends(require_admin()),
):
    """
    Permanently delete a restaurant (super_admin only).
    This does NOT delete subcollections (items, orders) — handle separately.
    """
    db = get_user_db()
    doc = db.collection("restaurants").document(restaurant_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    db.collection("restaurants").document(restaurant_id).delete()
    logger.info(f"Restaurant {restaurant_id} deleted by super_admin {user['uid']}")
    return MessageResponse(message="Restaurant deleted successfully")
