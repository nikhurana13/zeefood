"""
ZEfood Backend — Inventory Router
Item management with staff permission checks and owner approval workflow
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, status
from app.models.schemas import ItemCreate, ItemUpdate, ItemResponse, MessageResponse
from app.services.firebase import get_user_db, get_staff_db, upload_file_to_storage, doc_to_dict, collection_to_list
from app.middleware.auth_middleware import get_current_user, require_any_staff, require_owner
import uuid
import logging
from datetime import datetime, timezone

router = APIRouter(prefix="/inventory", tags=["Inventory"])
logger = logging.getLogger(__name__)


@router.get("/{restaurant_id}", response_model=list[ItemResponse])
async def list_items(restaurant_id: str, category: str = None, available_only: bool = False):
    """List all menu items for a restaurant (public endpoint)."""
    db = get_user_db()
    query = db.collection("restaurants").document(restaurant_id).collection("items")
    if available_only:
        query = query.where("is_available", "==", True)
    if category:
        query = query.where("category", "==", category)
    items = collection_to_list(query)
    return [ItemResponse(**i) for i in items]


@router.post("/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def add_item(
    payload: ItemCreate,
    user: dict = Depends(require_any_staff())
):
    """
    Add a new menu item.
    - Staff with can_add_items=True: item added as pending (requires owner approval)
    - Owner/super_admin: item added directly as active
    """
    db = get_user_db()

    # Check staff permissions
    role = user.get("role", "")
    pending_approval = False
    if role in ("kitchen", "delivery", "pantry", "manager", "staff"):
        # Staff profiles are stored in the staff Firebase project — use get_staff_db()
        staff_db = get_staff_db()
        staff_doc = staff_db.collection("staff").document(user["uid"]).get()
        perms = staff_doc.to_dict().get("permissions", {}) if staff_doc.exists else {}
        if not perms.get("can_add_items", False):
            raise HTTPException(status_code=403, detail="You do not have permission to add items")
        pending_approval = True

    item_id = str(uuid.uuid4())
    item_data = {
        "id": item_id,
        "name": payload.name,
        "description": payload.description,
        "price": payload.price,
        "category": payload.category,
        "restaurant_id": payload.restaurant_id,
        "is_vegetarian": payload.is_vegetarian,
        "is_available": payload.is_available and not pending_approval,
        "stock": payload.stock,
        "image_url": None,
        "emotion_score": {},
        "pending_approval": pending_approval,
        "created_by": user["uid"],
        "created_at": datetime.now(timezone.utc),
    }

    db.collection("restaurants").document(payload.restaurant_id).collection("items").document(item_id).set(item_data)
    return ItemResponse(**item_data)


@router.post("/items/{item_id}/image")
async def upload_item_image(
    item_id: str,
    restaurant_id: str,
    image: UploadFile = File(...),
    user: dict = Depends(require_any_staff()),
):
    """Upload an image for a menu item to Firebase Storage."""
    image_bytes = await image.read()
    path = f"items/{restaurant_id}/{item_id}{image.filename}"
    try:
        url = upload_file_to_storage(image_bytes, path, image.content_type)
        db = get_user_db()
        db.collection("restaurants").document(restaurant_id).collection("items").document(item_id).update({
            "image_url": url
        })
        return {"image_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image upload failed: {e}")


@router.patch("/items/{item_id}", response_model=ItemResponse)
async def update_item(
    item_id: str,
    restaurant_id: str,
    payload: ItemUpdate,
    user: dict = Depends(require_any_staff()),
):
    """Update item details (availability, stock, price, etc.)."""
    db = get_user_db()
    ref = db.collection("restaurants").document(restaurant_id).collection("items").document(item_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = payload.model_dump(exclude_none=True)
    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["updated_by"] = user["uid"]
    ref.update(update_data)

    return ItemResponse(**doc_to_dict(ref.get()))


@router.patch("/items/{item_id}/stock")
async def update_stock(
    item_id: str,
    restaurant_id: str,
    quantity: int,
    user: dict = Depends(require_any_staff()),
):
    """Quickly update stock quantity (staff-level access)."""
    db = get_user_db()
    ref = db.collection("restaurants").document(restaurant_id).collection("items").document(item_id)
    ref.update({"stock": quantity, "is_available": quantity > 0, "updated_at": datetime.now(timezone.utc)})
    return MessageResponse(message=f"Stock updated to {quantity}")


@router.patch("/items/{item_id}/approve", response_model=ItemResponse)
async def approve_item(
    item_id: str,
    restaurant_id: str,
    user: dict = Depends(require_owner()),
):
    """Owner approves a pending item added by staff."""
    db = get_user_db()
    ref = db.collection("restaurants").document(restaurant_id).collection("items").document(item_id)
    ref.update({"pending_approval": False, "is_available": True, "approved_by": user["uid"],
                 "approved_at": datetime.now(timezone.utc)})
    return ItemResponse(**doc_to_dict(ref.get()))


@router.delete("/items/{item_id}", response_model=MessageResponse)
async def delete_item(
    item_id: str,
    restaurant_id: str,
    user: dict = Depends(require_owner()),
):
    """Delete a menu item (owner/admin only)."""
    db = get_user_db()
    db.collection("restaurants").document(restaurant_id).collection("items").document(item_id).delete()
    return MessageResponse(message="Item deleted successfully")
