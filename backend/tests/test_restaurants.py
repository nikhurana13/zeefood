"""
ZEfood Backend — Restaurants Router Tests
Tests for restaurant CRUD (the newly added router).
"""
import pytest
from unittest.mock import patch, MagicMock


class TestRestaurantsEndpoints:
    """Tests for the new /api/v1/restaurants router."""

    def test_list_restaurants_public(self, client):
        """GET /restaurants should be accessible without auth."""
        mock_docs = []  # Empty — no restaurants
        mock_db = MagicMock()
        mock_db.collection.return_value.where.return_value.stream.return_value = iter(mock_docs)

        with patch("app.routers.restaurants.get_user_db", return_value=mock_db):
            response = client.get("/api/v1/restaurants/")

        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_restaurant_not_found(self, client):
        """GET /restaurants/{id} for unknown ID returns 404."""
        mock_doc = MagicMock()
        mock_doc.exists = False
        mock_db = MagicMock()
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

        with patch("app.routers.restaurants.get_user_db", return_value=mock_db):
            response = client.get("/api/v1/restaurants/nonexistent-id")

        assert response.status_code == 404

    def test_create_restaurant_requires_owner(self, client, auth_headers):
        """POST /restaurants should reject regular customers."""
        response = client.post(
            "/api/v1/restaurants/",
            headers=auth_headers,  # customer token
            json={
                "name": "Test Restaurant",
                "type": "restaurant",
                "owner_id": "some-uid",
            },
        )
        assert response.status_code == 403

    def test_create_restaurant_as_owner(self, client, owner_headers):
        """POST /restaurants should succeed for owner role."""
        mock_db = MagicMock()
        mock_admin_db = MagicMock()
        mock_db.collection.return_value.document.return_value.set = MagicMock()

        with patch("app.routers.restaurants.get_user_db", return_value=mock_db), \
             patch("app.routers.restaurants.get_admin_db", return_value=mock_admin_db):
            response = client.post(
                "/api/v1/restaurants/",
                headers=owner_headers,
                json={
                    "name": "My Test Restaurant",
                    "type": "restaurant",
                    "cuisine": ["Indian", "Chinese"],
                    "owner_id": "test-owner-uid",
                },
            )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "My Test Restaurant"
        assert data["owner_id"] == "test-owner-uid"  # Always uses token UID
        assert data["rating"] == 0.0

    def test_delete_restaurant_requires_superadmin(self, client, owner_headers):
        """DELETE /restaurants/{id} should only be allowed for super_admin."""
        response = client.delete(
            "/api/v1/restaurants/some-id",
            headers=owner_headers,  # owner token, not super_admin
        )
        assert response.status_code == 403
