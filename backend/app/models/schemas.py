"""
ZEfood Backend — Pydantic Schemas
Request/Response models for all API endpoints
"""
from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


# ════════════════════════════════════════════════
#  Enums
# ════════════════════════════════════════════════

class UserRole(str, Enum):
    customer = "customer"
    staff = "staff"
    owner = "owner"
    super_admin = "super_admin"


class RestaurantType(str, Enum):
    restaurant = "restaurant"
    hotel = "hotel"
    mart = "mart"


class OrderType(str, Enum):
    delivery = "delivery"
    room_service = "room_service"
    takeaway = "takeaway"


class OrderStatus(str, Enum):
    placed = "placed"
    accepted = "accepted"
    preparing = "preparing"
    ready = "ready"
    out_for_delivery = "out_for_delivery"
    delivered = "delivered"
    cancelled = "cancelled"


class ReviewType(str, Enum):
    text = "text"
    audio = "audio"


class StaffRole(str, Enum):
    kitchen = "kitchen"
    delivery = "delivery"
    pantry = "pantry"
    manager = "manager"


class EmotionLabel(str, Enum):
    joy = "joy"
    anger = "anger"
    sadness = "sadness"
    fear = "fear"
    surprise = "surprise"
    disgust = "disgust"
    neutral = "neutral"


# ════════════════════════════════════════════════
#  Auth Schemas
# ════════════════════════════════════════════════

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.customer
    restaurant_id: Optional[str] = None  # required for staff


class LoginRequest(BaseModel):
    firebase_id_token: str  # exchanged from Firebase client SDK


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserProfile"


class UserProfile(BaseModel):
    uid: str
    email: str
    name: str
    role: UserRole
    restaurant_id: Optional[str] = None


# ════════════════════════════════════════════════
#  Address / Location Schemas
# ════════════════════════════════════════════════

class Address(BaseModel):
    label: str = "Home"
    line1: str
    city: str
    pincode: str
    lat: Optional[float] = None
    lng: Optional[float] = None


# ════════════════════════════════════════════════
#  Restaurant Schemas
# ════════════════════════════════════════════════

class RestaurantCreate(BaseModel):
    name: str
    type: RestaurantType
    cuisine: List[str] = []
    lat: Optional[float] = None
    lng: Optional[float] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    owner_id: str


class RestaurantResponse(BaseModel):
    id: str
    name: str
    type: RestaurantType
    cuisine: List[str]
    rating: float = 0.0
    total_reviews: int = 0
    image_url: Optional[str] = None
    is_active: bool = True
    owner_id: str
    address: Optional[str] = None
    emotion_summary: Optional[Dict[str, float]] = None


# ════════════════════════════════════════════════
#  Inventory / Item Schemas
# ════════════════════════════════════════════════

class ItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float = Field(gt=0)
    category: str
    restaurant_id: str
    is_vegetarian: bool = True
    is_available: bool = True
    stock: Optional[int] = None


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    is_available: Optional[bool] = None
    stock: Optional[int] = None


class ItemResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    price: float
    category: str
    restaurant_id: str
    image_url: Optional[str] = None
    is_vegetarian: bool
    is_available: bool
    stock: Optional[int]
    emotion_score: Optional[Dict[str, float]] = None


# ════════════════════════════════════════════════
#  Order Schemas
# ════════════════════════════════════════════════

class OrderItem(BaseModel):
    item_id: str
    name: str
    quantity: int = Field(ge=1)
    price: float


class OrderCreate(BaseModel):
    restaurant_id: str
    type: OrderType
    items: List[OrderItem]
    delivery_address: Optional[Address] = None
    room_number: Optional[str] = None
    special_instructions: Optional[str] = None
    payment_method: str = "razorpay"


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    note: Optional[str] = None


class OrderResponse(BaseModel):
    id: str
    user_id: str
    restaurant_id: str
    type: OrderType
    items: List[OrderItem]
    status: OrderStatus
    total_amount: float
    payment_id: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    delivery_address: Optional[Address] = None
    room_number: Optional[str] = None
    special_instructions: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ════════════════════════════════════════════════
#  Review Schemas
# ════════════════════════════════════════════════

class TextReviewCreate(BaseModel):
    restaurant_id: str
    order_id: Optional[str] = None
    item_id: Optional[str] = None
    text: str
    rating: int = Field(ge=1, le=5)


class SentimentResult(BaseModel):
    label: EmotionLabel
    score: float
    all_scores: Optional[Dict[str, float]] = None


class AudioEmotionResult(BaseModel):
    transcript: str
    emotion: EmotionLabel
    arousal: float
    valence: float
    dominance: Optional[float] = None


class ReviewResponse(BaseModel):
    id: str
    user_id: str
    restaurant_id: str
    order_id: Optional[str]
    item_id: Optional[str]
    type: ReviewType
    text_content: Optional[str] = None
    audio_url: Optional[str] = None
    rating: Optional[int] = None
    sentiment: Optional[SentimentResult] = None
    audio_emotion: Optional[AudioEmotionResult] = None
    combined_emotion: Optional[EmotionLabel] = None
    created_at: Optional[datetime] = None


# ════════════════════════════════════════════════
#  Chatbot Schemas
# ════════════════════════════════════════════════

class ChatMessage(BaseModel):
    message: str
    order_id: Optional[str] = None
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str
    escalate: bool = False
    sources: Optional[List[str]] = None


class EscalateRequest(BaseModel):
    session_id: str
    reason: Optional[str] = None


# ════════════════════════════════════════════════
#  Staff Schemas
# ════════════════════════════════════════════════

class StaffCreate(BaseModel):
    email: EmailStr
    name: str
    restaurant_id: str
    role: StaffRole
    permissions: Optional[Dict[str, bool]] = None


class StaffUpdate(BaseModel):
    role: Optional[StaffRole] = None
    permissions: Optional[Dict[str, bool]] = None
    is_active: Optional[bool] = None


class StaffResponse(BaseModel):
    id: str
    uid: str
    email: str
    name: str
    restaurant_id: str
    role: StaffRole
    permissions: Dict[str, bool]
    is_active: bool
    created_at: Optional[datetime] = None


class StaffPermissions(BaseModel):
    can_add_items: bool = False
    can_update_stock: bool = True
    can_view_analytics: bool = False
    can_manage_orders: bool = True
    can_flag_issues: bool = True


# ════════════════════════════════════════════════
#  Recommendation Schemas
# ════════════════════════════════════════════════

class RestaurantScore(BaseModel):
    restaurant_id: str
    name: str
    score: float
    reason: Optional[str] = None
    image_url: Optional[str] = None


class DishScore(BaseModel):
    item_id: str
    name: str
    restaurant_id: str
    score: float
    emotion_tag: Optional[EmotionLabel] = None


# ════════════════════════════════════════════════
#  Analytics Schemas
# ════════════════════════════════════════════════

class HourlyDemand(BaseModel):
    hour: int  # 0-23
    expected_orders: int
    is_peak: bool


class DemandForecast(BaseModel):
    restaurant_id: str
    date: str
    hourly: List[HourlyDemand]
    peak_hours: List[int]
    alert_message: Optional[str] = None


class SentimentTrend(BaseModel):
    restaurant_id: str
    period: str  # e.g., "2024-01"
    emotion_breakdown: Dict[str, float]
    avg_rating: float
    total_reviews: int
    top_complaint: Optional[str] = None
    top_praise: Optional[str] = None


class OrderStats(BaseModel):
    restaurant_id: Optional[str]
    total_orders: int
    delivered: int
    cancelled: int
    avg_preparation_time_minutes: Optional[float]
    revenue: float


# ════════════════════════════════════════════════
#  Payment Schemas
# ════════════════════════════════════════════════

class PaymentInitRequest(BaseModel):
    order_id: str
    amount: float
    currency: str = "INR"


class PaymentInitResponse(BaseModel):
    razorpay_order_id: str
    amount: int  # in paise
    currency: str
    key_id: str


class PaymentVerifyRequest(BaseModel):
    order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# ════════════════════════════════════════════════
#  Generic
# ════════════════════════════════════════════════

class MessageResponse(BaseModel):
    message: str
    success: bool = True


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    has_next: bool
