"""
ZEfood Backend — FastAPI Application Entry Point
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import logging
import os

from app.config import get_settings
from app.services.firebase import init_firebase_apps
from app.services.rag_service import rag_service
from app.services.sentiment import sentiment_service
from app.services.audio_emotion import audio_emotion_service
from app.services.recommender import recommender_service
from app.services.demand_predict import demand_predictor
from app.services.realtime import manager

from app.routers import auth, orders, inventory, reviews, chatbot, recommendations, staff, analytics, restaurants

# ── Logging ───────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ── Rate Limiting (slowapi) ──────────────────────────────
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
    _rate_limiting_available = True
except ImportError:
    limiter = None
    _rate_limiting_available = False
    logger.warning("slowapi not installed — rate limiting disabled. Run: pip install slowapi")


# ── Lifespan (startup / shutdown) ─────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise all services on startup."""
    logger.info("🚀 ZEfood backend starting up...")
    settings = get_settings()

    # 1. Firebase
    init_firebase_apps()

    # 2. AI services
    sentiment_service.initialize(settings.sentiment_model_id)
    audio_emotion_service.initialize(settings.whisper_model_size, settings.audio_emotion_model_id)
    rag_service.initialize(
        settings.knowledge_base_path,
        settings.faiss_index_path,
        settings.gemini_api_key,
        settings.gemini_model,
    )
    recommender_service.initialize()
    demand_predictor.initialize()

    logger.info("✅ All services initialised. ZEfood is ready!")
    yield

    logger.info("🛑 ZEfood backend shutting down...")


# ── App factory ───────────────────────────────────────────
settings = get_settings()

app = FastAPI(
    title="ZEfood API",
    description=(
        "Multi-portal food delivery and hospitality management platform. "
        "Powers User App, Staff Panel, and Admin/Owner Panel."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Attach rate limiter if available
if _rate_limiting_available:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── Routers ───────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1")
app.include_router(restaurants.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")
app.include_router(inventory.router, prefix="/api/v1")
app.include_router(reviews.router, prefix="/api/v1")
app.include_router(chatbot.router, prefix="/api/v1")
app.include_router(recommendations.router, prefix="/api/v1")
app.include_router(staff.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")


# ── Health & Root ─────────────────────────────────────────
@app.get("/", tags=["Root"])
async def root():
    return {"service": "ZEfood API", "version": "1.0.0", "status": "running"}


@app.get("/health", tags=["Root"])
async def health():
    return {
        "status": "healthy",
        "services": {
            "firebase": "connected",
            "rag": "ready" if rag_service._ready else "stub",
            "sentiment": "ready" if sentiment_service._ready else "stub",
            "audio_emotion": "ready" if audio_emotion_service._ready else "stub",
            "recommender": "ready",
            "demand_predictor": "ready",
        },
    }


# ── Admin WebSocket ───────────────────────────────────────
@app.websocket("/ws/admin")
async def admin_ws(websocket: WebSocket):
    """Admin dashboard live feed WebSocket."""
    await manager.connect(websocket, "admin")
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, "admin")


# ── Dev entrypoint ────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.debug,
    )
