"""
ZEfood Backend — WebSocket Real-time Manager
Manages live connections for order tracking and staff notifications
"""
from fastapi import WebSocket
from typing import Dict, List, Set
import logging
import json

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections grouped by channel.
    Channel examples:
        order:{order_id}        → customer tracking a specific order
        restaurant:{id}         → staff panel watching incoming orders
        admin                   → admin dashboard feed
    """

    def __init__(self):
        # channel_key → set of connected WebSocket clients
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel: str) -> None:
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)
        logger.info(f"WebSocket connected: channel={channel}, total={len(self.active_connections[channel])}")

    def disconnect(self, websocket: WebSocket, channel: str) -> None:
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)
            if not self.active_connections[channel]:
                del self.active_connections[channel]
        logger.info(f"WebSocket disconnected: channel={channel}")

    async def broadcast_to_channel(self, channel: str, data: dict) -> None:
        """Send JSON data to all clients on a channel."""
        if channel not in self.active_connections:
            return
        dead: Set[WebSocket] = set()
        for ws in self.active_connections[channel].copy():
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        # Prune dead connections
        for ws in dead:
            self.active_connections[channel].discard(ws)

    async def send_order_update(self, order_id: str, status: str, data: dict) -> None:
        """Notify all clients tracking a specific order."""
        await self.broadcast_to_channel(
            f"order:{order_id}",
            {"type": "ORDER_STATUS_UPDATE", "order_id": order_id, "status": status, **data},
        )

    async def send_new_order_alert(self, restaurant_id: str, order: dict) -> None:
        """Notify staff panel of a new incoming order."""
        await self.broadcast_to_channel(
            f"restaurant:{restaurant_id}",
            {"type": "NEW_ORDER", "order": order},
        )

    async def send_demand_alert(self, restaurant_id: str, message: str) -> None:
        """Send AI demand spike alert to staff panel."""
        await self.broadcast_to_channel(
            f"restaurant:{restaurant_id}",
            {"type": "DEMAND_ALERT", "message": message, "restaurant_id": restaurant_id},
        )

    async def send_admin_event(self, event_type: str, data: dict) -> None:
        """Broadcast an event to all admin panel clients."""
        await self.broadcast_to_channel(
            "admin",
            {"type": event_type, **data},
        )


# Singleton instance shared across the app
manager = ConnectionManager()
