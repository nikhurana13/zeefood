"""
ZEfood Backend — Orders Router
Handles order placement, status updates, payment init/verify, and WebSocket tracking
"""
from fastapi import APIRouter, HTTPException, status, Depends, WebSocket, WebSocketDisconnect
from app.models.schemas import (
    OrderCreate, OrderResponse, OrderStatusUpdate, PaymentInitRequest,
    PaymentInitResponse, PaymentVerifyRequest, MessageResponse, OrderStatus
)
from app.services.firebase import get_user_db, doc_to_dict, collection_to_list
from app.services.realtime import manager
from app.middleware.auth_middleware import get_current_user, require_any_staff
from app.config import get_settings
import uuid
import logging
import hmac
import hashlib
from datetime import datetime, timezone

router = APIRouter(prefix="/orders", tags=["Orders"])
logger = logging.getLogger(__name__)
settings = get_settings()


def _calculate_total(items: list) -> float:
    return round(sum(i.price * i.quantity for i in items), 2)


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def place_order(payload: OrderCreate, user: dict = Depends(get_current_user)):
    """Place a new delivery or room-service order."""
    db = get_user_db()
    order_id = str(uuid.uuid4())
    total = _calculate_total(payload.items)

    order_data = {
        "id": order_id,
        "user_id": user["uid"],
        "restaurant_id": payload.restaurant_id,
        "type": payload.type.value,
        "items": [i.model_dump() for i in payload.items],
        "status": OrderStatus.placed.value,
        "total_amount": total,
        "delivery_address": payload.delivery_address.model_dump() if payload.delivery_address else None,
        "room_number": payload.room_number,
        "special_instructions": payload.special_instructions,
        "payment_method": payload.payment_method,
        "payment_id": None,
        "razorpay_order_id": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    db.collection("orders").document(order_id).set(order_data)

    # Notify staff panel via WebSocket
    await manager.send_new_order_alert(payload.restaurant_id, order_data)

    return OrderResponse(**order_data)


# NOTE: /user/history MUST be defined BEFORE /{order_id} — FastAPI matches top-to-bottom
# and "user" would otherwise be captured as order_id.
@router.get("/user/history", response_model=list[OrderResponse])
async def get_user_orders(user: dict = Depends(get_current_user)):
    """Get all orders for the current user (newest first).

    Requires a Firestore composite index on: orders — user_id ASC, created_at DESC
    Create at: Firebase Console → Firestore → Indexes → Add composite index
    """
    db = get_user_db()
    # Composite index required: user_id (ASC) + created_at (DESC)
    query = (
        db.collection("orders")
        .where("user_id", "==", user["uid"])
        .order_by("created_at", direction="DESCENDING")
    )
    orders = collection_to_list(query)
    return [OrderResponse(**o) for o in orders]


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    """Get a single order by ID."""
    db = get_user_db()
    doc = db.collection("orders").document(order_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Order not found")
    data = doc_to_dict(doc)

    # Customers can only see their own orders
    if user["role"] == "customer" and data["user_id"] != user["uid"]:
        raise HTTPException(status_code=403, detail="Access denied")

    return OrderResponse(**data)


@router.get("/restaurant/{restaurant_id}", response_model=list[OrderResponse])
async def get_restaurant_orders(
    restaurant_id: str,
    status_filter: str = None,
    user: dict = Depends(require_any_staff())
):
    """Get all orders for a restaurant (staff/owner)."""
    db = get_user_db()
    query = db.collection("orders").where("restaurant_id", "==", restaurant_id)
    if status_filter:
        query = query.where("status", "==", status_filter)
    orders = collection_to_list(query)
    return [OrderResponse(**o) for o in orders]


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    user: dict = Depends(require_any_staff())
):
    """Update the status of an order and broadcast via WebSocket."""
    db = get_user_db()
    ref = db.collection("orders").document(order_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Order not found")

    update_data = {
        "status": payload.status.value,
        "updated_at": datetime.now(timezone.utc),
    }
    if payload.note:
        update_data["staff_note"] = payload.note

    ref.update(update_data)
    data = doc_to_dict(ref.get())

    # Push real-time update to customer tracking this order
    await manager.send_order_update(order_id, payload.status.value, {"note": payload.note})
    # Also notify admin dashboard
    await manager.send_admin_event("ORDER_STATUS_CHANGED", {"order_id": order_id, "status": payload.status.value})

    return OrderResponse(**data)


# ── Razorpay Payment ──────────────────────────────────────

@router.post("/payment/init", response_model=PaymentInitResponse)
async def init_payment(payload: PaymentInitRequest, user: dict = Depends(get_current_user)):
    """Create a Razorpay order and return the order ID for client-side payment."""
    try:
        import razorpay
        client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
        amount_paise = int(payload.amount * 100)
        rp_order = client.order.create({
            "amount": amount_paise,
            "currency": payload.currency,
            "receipt": f"zefood_{payload.order_id}",
        })
        # Save razorpay_order_id to our order
        db = get_user_db()
        db.collection("orders").document(payload.order_id).update({
            "razorpay_order_id": rp_order["id"]
        })
        return PaymentInitResponse(
            razorpay_order_id=rp_order["id"],
            amount=amount_paise,
            currency=payload.currency,
            key_id=settings.razorpay_key_id,
        )
    except Exception as e:
        logger.error(f"Razorpay init error: {e}")
        raise HTTPException(status_code=500, detail="Payment gateway error")


@router.post("/payment/verify", response_model=MessageResponse)
async def verify_payment(payload: PaymentVerifyRequest, user: dict = Depends(get_current_user)):
    """Verify Razorpay payment signature and mark order as paid."""
    expected_sig = hmac.new(
        settings.razorpay_key_secret.encode(),
        f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    db = get_user_db()
    db.collection("orders").document(payload.order_id).update({
        "payment_id": payload.razorpay_payment_id,
        "status": OrderStatus.accepted.value,
        "updated_at": datetime.now(timezone.utc),
    })
    return MessageResponse(message="Payment verified successfully")


# ── WebSocket Live Tracking ───────────────────────────────

@router.websocket("/ws/{order_id}")
async def order_tracking_ws(websocket: WebSocket, order_id: str):
    """WebSocket endpoint for real-time order status updates."""
    channel = f"order:{order_id}"
    await manager.connect(websocket, channel)
    try:
        while True:
            data = await websocket.receive_text()
            # Ping-pong keepalive
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)


@router.websocket("/ws/restaurant/{restaurant_id}")
async def restaurant_orders_ws(websocket: WebSocket, restaurant_id: str):
    """WebSocket for staff to receive new order alerts."""
    channel = f"restaurant:{restaurant_id}"
    await manager.connect(websocket, channel)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)
