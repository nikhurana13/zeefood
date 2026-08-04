"""
ZEfood Backend — Test Configuration
Shared fixtures and mock setup for all test modules.
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient


# ── Mock Firebase before importing app ──────────────────────

@pytest.fixture(autouse=True, scope="session")
def mock_firebase_env(monkeysession):
    """Provide required env vars so Settings() doesn't fail in tests."""
    import os
    os.environ.setdefault("FIREBASE_USER_APP_CREDENTIALS", "/tmp/fake_user.json")
    os.environ.setdefault("FIREBASE_STAFF_CREDENTIALS", "/tmp/fake_staff.json")
    os.environ.setdefault("FIREBASE_ADMIN_CREDENTIALS", "/tmp/fake_admin.json")
    os.environ.setdefault("FIREBASE_USER_APP_PROJECT_ID", "test-user-project")
    os.environ.setdefault("FIREBASE_STAFF_PROJECT_ID", "test-staff-project")
    os.environ.setdefault("FIREBASE_ADMIN_PROJECT_ID", "test-admin-project")
    os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests")


@pytest.fixture(scope="session")
def mock_firebase():
    """Mock all Firebase Admin SDK calls."""
    with patch("firebase_admin.initialize_app") as mock_init, \
         patch("firebase_admin.get_app") as mock_get, \
         patch("firebase_admin.credentials.Certificate") as mock_cert, \
         patch("firebase_admin.firestore.client") as mock_fs:
        mock_fs.return_value = MagicMock()
        yield {
            "init_app": mock_init,
            "get_app": mock_get,
            "firestore": mock_fs,
        }


@pytest.fixture(scope="session")
def client(mock_firebase, mock_firebase_env):
    """Create a FastAPI test client with all Firebase mocked."""
    with patch("app.services.firebase.init_firebase_apps"):
        with patch("app.services.rag_service.rag_service") as mock_rag, \
             patch("app.services.sentiment.sentiment_service") as mock_sent, \
             patch("app.services.audio_emotion.audio_emotion_service") as mock_audio, \
             patch("app.services.recommender.recommender_service") as mock_rec, \
             patch("app.services.demand_predict.demand_predictor") as mock_demand:
            mock_rag._ready = False
            mock_sent._ready = False
            mock_audio._ready = False
            from app.main import app
            return TestClient(app)


@pytest.fixture
def auth_headers():
    """Generate a valid JWT for testing authenticated endpoints."""
    from app.middleware.auth_middleware import create_access_token
    token = create_access_token({
        "uid": "test-user-uid",
        "email": "test@zefood.com",
        "role": "customer",
        "restaurant_id": None,
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def owner_headers():
    """Generate a valid JWT for owner-level access."""
    from app.middleware.auth_middleware import create_access_token
    token = create_access_token({
        "uid": "test-owner-uid",
        "email": "owner@zefood.com",
        "role": "owner",
        "restaurant_id": "test-restaurant-id",
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def staff_headers():
    """Generate a valid JWT for staff-level access."""
    from app.middleware.auth_middleware import create_access_token
    token = create_access_token({
        "uid": "test-staff-uid",
        "email": "staff@zefood.com",
        "role": "kitchen",
        "restaurant_id": "test-restaurant-id",
    })
    return {"Authorization": f"Bearer {token}"}


# Allow session-scoped monkeypatching
@pytest.fixture(scope="session")
def monkeysession(request):
    from _pytest.monkeypatch import MonkeyPatch
    mpatch = MonkeyPatch()
    yield mpatch
    mpatch.undo()
