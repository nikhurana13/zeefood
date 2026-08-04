"""
ZEfood Backend — Auth Router Tests
Tests for /api/v1/auth endpoints
"""
import pytest
from unittest.mock import patch, MagicMock
from app.middleware.auth_middleware import create_access_token, decode_access_token
from fastapi.testclient import TestClient


class TestJWTHelpers:
    """Unit tests for JWT utility functions (no network needed)."""

    def test_create_and_decode_token(self):
        """Token created must round-trip through decode correctly."""
        payload = {"uid": "user123", "role": "customer", "email": "u@test.com"}
        token = create_access_token(payload)
        decoded = decode_access_token(token)
        assert decoded["uid"] == "user123"
        assert decoded["role"] == "customer"

    def test_invalid_token_raises(self):
        """Decoding a garbage token should raise HTTP 401."""
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            decode_access_token("not.a.valid.token")
        assert exc.value.status_code == 401

    def test_token_has_expiry(self):
        """Issued tokens must contain an 'exp' claim."""
        token = create_access_token({"uid": "u1"})
        decoded = decode_access_token(token)
        assert "exp" in decoded


class TestAuthEndpoints:
    """Integration tests for /api/v1/auth routes."""

    def test_get_me_unauthenticated_returns_403(self, client):
        """GET /auth/me without token should return 403."""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 403

    def test_get_me_with_valid_token(self, client, auth_headers):
        """GET /auth/me with valid JWT should return user profile."""
        response = client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["uid"] == "test-user-uid"
        assert data["role"] == "customer"

    def test_login_invalid_firebase_token_returns_401(self, client):
        """POST /auth/login with bad Firebase token should return 401."""
        with patch("app.routers.auth.verify_firebase_token", side_effect=Exception("Invalid token")):
            response = client.post(
                "/api/v1/auth/login",
                json={"firebase_id_token": "fake-token"},
            )
        assert response.status_code == 401
