"""
ZEfood Backend — Auth Router
Handles registration, login, and profile retrieval across all three portals
"""
from fastapi import APIRouter, HTTPException, status, Depends
from app.models.schemas import (
    RegisterRequest, LoginRequest, TokenResponse, UserProfile, MessageResponse
)
from app.services.firebase import (
    verify_firebase_token, create_firebase_user, get_user_db, get_staff_db, get_admin_db,
)
from app.middleware.auth_middleware import create_access_token, get_current_user
import logging
from datetime import datetime, timezone

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)

# Portal → Firebase app name mapping
PORTAL_APP_MAP = {
    "customer": ("user_app", get_user_db),
    "staff": ("staff_app", get_staff_db),
    "owner": ("admin_app", get_admin_db),
    "super_admin": ("admin_app", get_admin_db),
}


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest):
    """Register a new user in the appropriate Firebase project."""
    role = payload.role.value
    app_name, get_db = PORTAL_APP_MAP.get(role, ("user_app", get_user_db))

    try:
        # 1. Create Firebase Auth user
        fb_user = create_firebase_user(
            email=payload.email,
            password=payload.password,
            display_name=payload.name,
            app_name=app_name,
        )

        # 2. Create Firestore profile document
        db = get_db()
        collection = "users" if role == "customer" else ("staff" if role in ("staff",) else "owners")
        doc_data = {
            "uid": fb_user.uid,
            "email": payload.email,
            "name": payload.name,
            "phone": payload.phone,
            "role": role,
            "created_at": datetime.now(timezone.utc),
            "is_active": True,
        }
        if role in ("staff",) and payload.restaurant_id:
            doc_data["restaurant_id"] = payload.restaurant_id
            doc_data["permissions"] = {
                "can_add_items": False,
                "can_update_stock": True,
                "can_view_analytics": False,
                "can_manage_orders": True,
                "can_flag_issues": True,
            }

        db.collection(collection).document(fb_user.uid).set(doc_data)

        # 3. Issue internal JWT
        token = create_access_token({
            "uid": fb_user.uid,
            "email": payload.email,
            "role": role,
            "restaurant_id": payload.restaurant_id,
        })

        profile = UserProfile(
            uid=fb_user.uid,
            email=payload.email,
            name=payload.name,
            role=payload.role,
            restaurant_id=payload.restaurant_id,
        )
        return TokenResponse(access_token=token, user=profile)

    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    """
    Exchange a Firebase ID token (from client SDK) for an internal JWT.
    The client must call Firebase signInWithEmailAndPassword, get the ID token,
    and pass it here.
    """
    # Try all three Firebase apps
    for app_name, get_db, collection, role_field in [
        ("user_app", get_user_db, "users", "customer"),
        ("staff_app", get_staff_db, "staff", "staff"),
        ("admin_app", get_admin_db, "owners", "owner"),
    ]:
        try:
            decoded = verify_firebase_token(payload.firebase_id_token, app_name)
            uid = decoded["uid"]
            db = get_db()
            doc = db.collection(collection).document(uid).get()
            if doc.exists:
                profile_data = doc.to_dict()
                role = profile_data.get("role", role_field)
                token = create_access_token({
                    "uid": uid,
                    "email": decoded.get("email", ""),
                    "role": role,
                    "restaurant_id": profile_data.get("restaurant_id"),
                })
                profile = UserProfile(
                    uid=uid,
                    email=decoded.get("email", ""),
                    name=profile_data.get("name", ""),
                    role=role,
                    restaurant_id=profile_data.get("restaurant_id"),
                )
                return TokenResponse(access_token=token, user=profile)
        except Exception:
            continue

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token or user not found")


@router.get("/me", response_model=UserProfile)
async def get_me(user: dict = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return UserProfile(
        uid=user["uid"],
        email=user.get("email", ""),
        name=user.get("name", ""),
        role=user.get("role", "customer"),
        restaurant_id=user.get("restaurant_id"),
    )
