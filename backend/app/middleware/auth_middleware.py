"""
ZEfood Backend — Auth Middleware
Verifies Firebase ID tokens or internal JWTs on protected routes.
"""
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
import logging

from app.config import get_settings
from app.services.firebase import verify_firebase_token

logger = logging.getLogger(__name__)
settings = get_settings()

security = HTTPBearer()


# ── JWT helpers ───────────────────────────────────────────

def create_access_token(data: dict) -> str:
    """Create a signed JWT with an expiry."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Decode and verify a JWT. Raises HTTPException on failure."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── Dependency: get current user ──────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    FastAPI dependency — extract & verify the Bearer token.
    Returns the decoded payload dict including 'uid', 'role', etc.
    """
    token = credentials.credentials
    payload = decode_access_token(token)

    if "uid" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user identity",
        )
    return payload


# ── Role guards ───────────────────────────────────────────

def require_role(*allowed_roles: str):
    """
    Dependency factory that enforces role-based access.
    Usage: Depends(require_role("owner", "super_admin"))
    """
    async def _guard(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {list(allowed_roles)}",
            )
        return user
    return _guard


def require_any_staff():
    """Convenience guard for staff, owner, super_admin."""
    return require_role("staff", "owner", "super_admin", "kitchen", "delivery", "pantry", "manager")


def require_owner():
    return require_role("owner", "super_admin")


def require_admin():
    return require_role("super_admin")
