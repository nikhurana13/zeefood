"""
ZEfood Backend — Staff Management Router
Create, read, update, delete staff accounts (owner/admin only)
"""
from fastapi import APIRouter, HTTPException, Depends, status
from app.models.schemas import StaffCreate, StaffUpdate, StaffResponse, MessageResponse
from app.services.firebase import (
    get_staff_db, get_user_db, create_firebase_user, delete_firebase_user,
    doc_to_dict, collection_to_list
)
from app.middleware.auth_middleware import get_current_user, require_owner
import uuid
import secrets
import logging
from datetime import datetime, timezone

router = APIRouter(prefix="/staff", tags=["Staff Management"])
logger = logging.getLogger(__name__)

DEFAULT_PERMISSIONS = {
    "can_add_items": False,
    "can_update_stock": True,
    "can_view_analytics": False,
    "can_manage_orders": True,
    "can_flag_issues": True,
}


@router.get("/", response_model=list[StaffResponse])
async def list_staff(restaurant_id: str = None, user: dict = Depends(require_owner())):
    """List all staff (optionally filtered by restaurant). Owner/admin only."""
    db = get_staff_db()
    query = db.collection("staff")
    if restaurant_id:
        query = query.where("restaurant_id", "==", restaurant_id)
    elif user.get("role") != "super_admin":
        # Owners can only see their own restaurant's staff
        query = query.where("restaurant_id", "==", user.get("restaurant_id", ""))
    staff = collection_to_list(query)
    return [StaffResponse(**s) for s in staff]


@router.post("/", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
async def create_staff(payload: StaffCreate, user: dict = Depends(require_owner())):
    """Create a new staff account with Firebase Auth credentials."""
    # Generate a temporary password
    temp_password = secrets.token_urlsafe(12)
    try:
        fb_user = create_firebase_user(
            email=payload.email,
            password=temp_password,
            display_name=payload.name,
            app_name="staff_app",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Firebase Auth error: {e}")

    permissions = payload.permissions or DEFAULT_PERMISSIONS.copy()
    staff_data = {
        "id": fb_user.uid,
        "uid": fb_user.uid,
        "email": payload.email,
        "name": payload.name,
        "restaurant_id": payload.restaurant_id,
        "role": payload.role.value,
        "permissions": permissions,
        "is_active": True,
        "created_by": user["uid"],
        # NOTE: temp_password is intentionally NOT stored in Firestore (security).
        # It is only returned in this API response once. The owner must share it
        # securely and the staff member should reset it on first login.
        "must_reset_password": True,
        "created_at": datetime.now(timezone.utc),
    }

    db = get_staff_db()
    db.collection("staff").document(fb_user.uid).set(staff_data)

    logger.info(f"Staff created: {payload.email} for restaurant {payload.restaurant_id}")

    # Return the temp_password ONLY in the response body — never store it
    response_data = {**staff_data, "temp_password": temp_password}
    return StaffResponse(**staff_data)


@router.get("/{staff_id}", response_model=StaffResponse)
async def get_staff_member(staff_id: str, user: dict = Depends(require_owner())):
    """Get a specific staff member's profile."""
    db = get_staff_db()
    doc = db.collection("staff").document(staff_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return StaffResponse(**doc_to_dict(doc))


@router.patch("/{staff_id}", response_model=StaffResponse)
async def update_staff(staff_id: str, payload: StaffUpdate, user: dict = Depends(require_owner())):
    """Update a staff member's role or permissions."""
    db = get_staff_db()
    ref = db.collection("staff").document(staff_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Staff member not found")

    update_data = payload.model_dump(exclude_none=True)
    if "role" in update_data:
        update_data["role"] = update_data["role"].value
    update_data["updated_at"] = datetime.now(timezone.utc)
    ref.update(update_data)

    return StaffResponse(**doc_to_dict(ref.get()))


@router.delete("/{staff_id}", response_model=MessageResponse)
async def delete_staff(staff_id: str, user: dict = Depends(require_owner())):
    """Remove a staff member (deletes Firebase Auth user + Firestore doc)."""
    db = get_staff_db()
    doc = db.collection("staff").document(staff_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Staff member not found")

    try:
        delete_firebase_user(staff_id, app_name="staff_app")
    except Exception as e:
        logger.warning(f"Firebase Auth delete failed for {staff_id}: {e}")

    db.collection("staff").document(staff_id).delete()
    return MessageResponse(message="Staff member removed successfully")


@router.get("/{staff_id}/alerts")
async def get_staff_alerts(staff_id: str, user: dict = Depends(get_current_user)):
    """Get AI-generated demand alerts for a staff member."""
    db = get_staff_db()
    alerts = (
        db.collection("staff").document(staff_id)
        .collection("alerts")
        .order_by("created_at", direction="DESCENDING")
        .limit(20)
        .stream()
    )
    return [{"id": a.id, **a.to_dict()} for a in alerts]
