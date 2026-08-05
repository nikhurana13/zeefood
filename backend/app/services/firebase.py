"""
ZEfood Backend — Firebase Admin SDK Service
Manages connections to all three Firebase projects.

Credential resolution order:
  1. If the value looks like a JSON string (starts with '{') → parse inline JSON
  2. Otherwise treat as a file path (legacy / Docker volume mount)

This allows Render.com deployments to pass the full JSON content as an
environment variable without needing to mount files.
"""
import json
import os
import firebase_admin
from firebase_admin import credentials, firestore, auth, storage
from typing import Optional
import logging
from app.config import get_settings

logger = logging.getLogger(__name__)

# ── App instances (one per Firebase project) ──────────────
_user_app: Optional[firebase_admin.App] = None
_staff_app: Optional[firebase_admin.App] = None
_admin_app: Optional[firebase_admin.App] = None

# ── Firestore client instances ────────────────────────────
_user_db: Optional[firestore.Client] = None
_staff_db: Optional[firestore.Client] = None
_admin_db: Optional[firestore.Client] = None


def _resolve_credential(value: str) -> credentials.Certificate:
    """
    Accepts either:
    - A JSON string: '{"type": "service_account", ...}'
    - A file path:   '/app/credentials/service-account.json'
    Returns a Firebase credentials.Certificate object.
    """
    stripped = value.strip()
    if stripped.startswith("{"):
        # Inline JSON — parse directly
        cred_dict = json.loads(stripped)
        return credentials.Certificate(cred_dict)
    else:
        # File path
        if not os.path.exists(stripped):
            raise FileNotFoundError(
                f"Firebase credential file not found: {stripped}\n"
                "Tip: On Render, set the env var to the full JSON content instead of a file path."
            )
        return credentials.Certificate(stripped)


def init_firebase_apps() -> None:
    """Initialise all three Firebase Admin SDK apps."""
    global _user_app, _staff_app, _admin_app
    global _user_db, _staff_db, _admin_db

    settings = get_settings()

    # User App (zeefood-c72cd)
    if not _user_app:
        try:
            _user_app = firebase_admin.initialize_app(
                _resolve_credential(settings.firebase_user_app_credentials),
                {
                    "storageBucket": settings.user_app_storage_bucket,
                    "projectId": settings.firebase_user_app_project_id,
                },
                name="user_app",
            )
            _user_db = firestore.client(app=_user_app)
            logger.info("✅ Firebase User App initialised")
        except ValueError:
            # Already initialised
            _user_app = firebase_admin.get_app("user_app")
            _user_db = firestore.client(app=_user_app)

    # Staff App (staff-1ac19)
    if not _staff_app:
        try:
            _staff_app = firebase_admin.initialize_app(
                _resolve_credential(settings.firebase_staff_credentials),
                {"projectId": settings.firebase_staff_project_id},
                name="staff_app",
            )
            _staff_db = firestore.client(app=_staff_app)
            logger.info("✅ Firebase Staff App initialised")
        except ValueError:
            _staff_app = firebase_admin.get_app("staff_app")
            _staff_db = firestore.client(app=_staff_app)

    # Admin App (admin-ca01a)
    if not _admin_app:
        try:
            _admin_app = firebase_admin.initialize_app(
                _resolve_credential(settings.firebase_admin_credentials),
                {"projectId": settings.firebase_admin_project_id},
                name="admin_app",
            )
            _admin_db = firestore.client(app=_admin_app)
            logger.info("✅ Firebase Admin App initialised")
        except ValueError:
            _admin_app = firebase_admin.get_app("admin_app")
            _admin_db = firestore.client(app=_admin_app)


# ── Getters ───────────────────────────────────────────────

def get_user_db() -> firestore.Client:
    if _user_db is None:
        init_firebase_apps()
    return _user_db


def get_staff_db() -> firestore.Client:
    if _staff_db is None:
        init_firebase_apps()
    return _staff_db


def get_admin_db() -> firestore.Client:
    if _admin_db is None:
        init_firebase_apps()
    return _admin_db


def get_user_app() -> firebase_admin.App:
    if _user_app is None:
        init_firebase_apps()
    return _user_app


def get_staff_app() -> firebase_admin.App:
    if _staff_app is None:
        init_firebase_apps()
    return _staff_app


def get_admin_app() -> firebase_admin.App:
    if _admin_app is None:
        init_firebase_apps()
    return _admin_app


# ── Firebase Auth helpers ─────────────────────────────────

def verify_firebase_token(id_token: str, app_name: str = "user_app") -> dict:
    """
    Verify a Firebase ID token from the client SDK.
    Returns the decoded token claims dict.
    """
    app = firebase_admin.get_app(app_name)
    decoded = auth.verify_id_token(id_token, app=app)
    return decoded


def create_firebase_user(email: str, password: str, display_name: str,
                          app_name: str = "user_app") -> auth.UserRecord:
    """Create a user in a Firebase Auth project."""
    app = firebase_admin.get_app(app_name)
    return auth.create_user(
        email=email,
        password=password,
        display_name=display_name,
        app=app,
    )


def get_firebase_user(uid: str, app_name: str = "user_app") -> auth.UserRecord:
    app = firebase_admin.get_app(app_name)
    return auth.get_user(uid, app=app)


def delete_firebase_user(uid: str, app_name: str = "user_app") -> None:
    app = firebase_admin.get_app(app_name)
    auth.delete_user(uid, app=app)


# ── Storage helpers ───────────────────────────────────────

def get_storage_bucket():
    """Return the Firebase Storage bucket for the User App."""
    app = get_user_app()
    return storage.bucket(app=app)


def upload_file_to_storage(file_bytes: bytes, destination_path: str,
                            content_type: str = "application/octet-stream") -> str:
    """
    Upload raw bytes to Firebase Storage and return the public URL.
    destination_path example: "reviews/audio/uuid.webm"
    """
    bucket = get_storage_bucket()
    blob = bucket.blob(destination_path)
    blob.upload_from_string(file_bytes, content_type=content_type)
    blob.make_public()
    return blob.public_url


# ── Firestore helpers ─────────────────────────────────────

def doc_to_dict(doc) -> dict:
    """Convert a Firestore DocumentSnapshot to a plain dict with 'id' injected."""
    if not doc.exists:
        return {}
    data = doc.to_dict()
    data["id"] = doc.id
    return data


def collection_to_list(query) -> list:
    """Convert a Firestore Query / CollectionReference to a list of dicts."""
    return [doc_to_dict(d) for d in query.stream()]
