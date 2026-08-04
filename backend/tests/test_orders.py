"""
ZEfood Backend — Orders Router Tests
Tests for order route ordering, payment verification, and WebSocket connections.
"""
import pytest
import hmac
import hashlib
from unittest.mock import patch, MagicMock


class TestRouteOrdering:
    """Verify the critical /user/history vs /{order_id} route fix."""

    def test_user_history_not_treated_as_order_id(self, client, auth_headers):
        """
        GET /orders/user/history should NOT be caught by GET /orders/{order_id}.
        Before the fix, 'user' would be treated as an order_id and return 404/wrong data.
        After the fix, it should return a list (even if empty).
        """
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_query.stream.return_value = []
        mock_db.collection.return_value.where.return_value.order_by.return_value = mock_query

        with patch("app.routers.orders.get_user_db", return_value=mock_db):
            response = client.get("/api/v1/orders/user/history", headers=auth_headers)

        # Should return 200 with a list, NOT 404 or treating "user" as an order ID
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_order_by_id_still_works(self, client, auth_headers):
        """GET /orders/{real_id} should still work after the route reorder."""
        mock_doc = MagicMock()
        mock_doc.exists = False
        mock_db = MagicMock()
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

        with patch("app.routers.orders.get_user_db", return_value=mock_db):
            response = client.get("/api/v1/orders/some-order-uuid", headers=auth_headers)

        assert response.status_code == 404  # Not found is correct (doc doesn't exist)
        assert "not found" in response.json()["detail"].lower()


class TestPaymentVerification:
    """Test Razorpay signature verification."""

    def test_valid_signature_accepted(self, client, auth_headers):
        """A correctly-signed Razorpay payload should succeed."""
        from app.config import get_settings
        settings = get_settings()
        secret = settings.razorpay_key_secret

        rp_order_id = "order_test123"
        rp_payment_id = "pay_test456"
        expected_sig = hmac.new(
            secret.encode(),
            f"{rp_order_id}|{rp_payment_id}".encode(),
            hashlib.sha256,
        ).hexdigest()

        mock_db = MagicMock()
        mock_db.collection.return_value.document.return_value.update = MagicMock()

        with patch("app.routers.orders.get_user_db", return_value=mock_db):
            response = client.post(
                "/api/v1/orders/payment/verify",
                headers=auth_headers,
                json={
                    "order_id": "zefood-order-id",
                    "razorpay_order_id": rp_order_id,
                    "razorpay_payment_id": rp_payment_id,
                    "razorpay_signature": expected_sig,
                },
            )
        assert response.status_code == 200

    def test_invalid_signature_rejected(self, client, auth_headers):
        """A bad signature should return 400."""
        response = client.post(
            "/api/v1/orders/payment/verify",
            headers=auth_headers,
            json={
                "order_id": "zefood-order-id",
                "razorpay_order_id": "order_test123",
                "razorpay_payment_id": "pay_test456",
                "razorpay_signature": "bad-signature",
            },
        )
        assert response.status_code == 400
        assert "signature" in response.json()["detail"].lower()
