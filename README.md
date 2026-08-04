# ZEfood Platform — Complete Setup Guide

## 🍽️ Overview

ZEfood is a full-stack AI-integrated food delivery and hospitality management platform with three portals:

| Portal | URL | Firebase Project |
|--------|-----|-----------------|
| **User App** | http://localhost:3000 | `zeefood-c72cd` |
| **Staff Panel** | http://localhost:3001 | `staff-1ac19` |
| **Admin Panel** | http://localhost:3002 | `admin-ca01a` |
| **FastAPI Backend** | http://localhost:8000 | All three |
| **API Docs** | http://localhost:8000/docs | — |

---

## 🏗️ Project Structure

```
zefood/
├── backend/                  FastAPI backend (Python 3.11)
│   ├── app/
│   │   ├── main.py           App entry point
│   │   ├── config.py         Settings (Pydantic)
│   │   ├── routers/          8 API routers
│   │   │   ├── auth.py
│   │   │   ├── orders.py     + WebSocket tracking
│   │   │   ├── inventory.py
│   │   │   ├── reviews.py
│   │   │   ├── chatbot.py
│   │   │   ├── recommendations.py
│   │   │   ├── staff.py
│   │   │   └── analytics.py
│   │   ├── services/         AI/ML services
│   │   │   ├── firebase.py   3-project Firebase wrapper
│   │   │   ├── rag_service.py    FAISS + Gemini RAG chatbot
│   │   │   ├── sentiment.py      DistilRoBERTa emotion NLP
│   │   │   ├── audio_emotion.py  Whisper + wav2vec2
│   │   │   ├── recommender.py    Hybrid CF + emotion recs
│   │   │   ├── demand_predict.py Prophet forecasting
│   │   │   └── realtime.py   WebSocket manager
│   │   ├── models/
│   │   │   └── schemas.py    Pydantic request/response models
│   │   └── middleware/
│   │       └── auth_middleware.py JWT + RBAC
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── admin-panel/          React + Vite (port 3002)
│   ├── staff-panel/          React + Vite (port 3001)
│   └── user-app/             React + Vite (port 3000)
│
├── docker-compose.yml
└── README.md
```

---

## ⚡ Quick Start (Development)

### 1. Configure Backend Environment

```bash
cd backend
copy .env.example .env
# Edit .env and fill in:
# - Firebase service account paths (already set to your Downloads folder)
# - GEMINI_API_KEY (from Google AI Studio)
# - RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
```

### 2. Run Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Visit http://localhost:8000/docs for the interactive API documentation.

### 3. Run Frontends (three separate terminals)

```bash
# Terminal 1 — User App
cd frontend/user-app
npm run dev -- --port 3000

# Terminal 2 — Staff Panel
cd frontend/staff-panel
npm run dev -- --port 3001

# Terminal 3 — Admin Panel
cd frontend/admin-panel
npm run dev -- --port 3002
```

---

## 🐳 Docker Deployment

```bash
# Copy and fill .env file
cp backend/.env.example backend/.env
# Edit backend/.env

# Build and start all services
docker-compose up --build

# Services will be available at:
# Backend: http://localhost:8000
# User App: http://localhost:3000
# Staff Panel: http://localhost:3001
# Admin Panel: http://localhost:3002
```

---

## 🔑 Authentication Flow

ZEfood uses **Firebase Authentication** with role-based access:

1. **Client** calls Firebase `signInWithEmailAndPassword`
2. **Client** gets a Firebase ID Token
3. **Client** POSTs the ID token to `/api/v1/auth/login`
4. **Backend** verifies the Firebase ID token, looks up the Firestore profile
5. **Backend** issues an internal JWT with `uid`, `email`, `role`
6. **Client** includes the JWT as `Authorization: Bearer <token>` on all subsequent requests

> **Demo Mode**: The frontends have a fallback that works without Firebase configured —
> they create a local mock user so you can explore the UI immediately.

---

## 🤖 AI/ML Services

| Service | Model | Status |
|---------|-------|--------|
| **RAG Chatbot** | FAISS + `all-MiniLM-L6-v2` + Google Gemini | Auto-seeded with 14 FAQ documents |
| **Text Sentiment** | `j-hartmann/emotion-english-distilroberta-base` | 7 emotions |
| **Audio Emotion** | OpenAI Whisper + `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim` | Arousal/Valence/Dominance |
| **Recommender** | Collaborative Filtering + Emotion Boost | In-memory, Firestore-backed in prod |
| **Demand Forecast** | Prophet (with heuristic fallback) | 24h hourly predictions |

All services start in **stub mode** if dependencies are unavailable, and activate automatically when models load successfully.

---

## 📦 Firestore Schema

### User App (`zeefood-c72cd`)
```
users/{uid}               Customer profiles
restaurants/{id}          Restaurant/hotel/mart listings
restaurants/{id}/items/{itemId}  Menu items with emotion scores
orders/{orderId}          All orders (delivery + room service)
reviews/{reviewId}        Reviews with AI emotion labels
chat_sessions/{sessionId} Chatbot conversation logs
support_tickets/{id}      Escalated support cases
```

### Staff App (`staff-1ac19`)
```
staff/{uid}               Staff profiles + permissions
staff/{uid}/alerts/{id}   AI demand spike alerts
```

### Admin App (`admin-ca01a`)
```
owners/{uid}              Owner profiles
analytics/{restaurantId}/demand/{date}  Demand forecasts
```

---

## 💳 Razorpay Integration

1. Sign up at https://razorpay.com and get test API keys
2. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `backend/.env`
3. The User App cart screen uses `/api/v1/orders/payment/init` to create a Razorpay order
4. On payment success, the client calls `/api/v1/orders/payment/verify` to verify the signature

---

## 🔌 WebSocket Events

| Channel | Event | Description |
|---------|-------|-------------|
| `order:{id}` | `ORDER_STATUS_UPDATE` | Customer gets live tracking |
| `restaurant:{id}` | `NEW_ORDER` | Staff notified of new orders |
| `restaurant:{id}` | `DEMAND_ALERT` | AI demand spike notification |
| `admin` | `ORDER_STATUS_CHANGED` | Admin dashboard live feed |

---

## 🚀 Cloud Deployment (Firebase Hosting + Cloud Run)

```bash
# Backend → Cloud Run
gcloud run deploy zefood-backend --source ./backend --region asia-south1

# Frontend → Firebase Hosting
cd frontend/user-app && npm run build
firebase deploy --only hosting:user-app

cd frontend/admin-panel && npm run build
firebase deploy --only hosting:admin-panel

cd frontend/staff-panel && npm run build
firebase deploy --only hosting:staff-panel
```

---

## 🧪 Testing

```bash
cd backend
pip install pytest pytest-asyncio
pytest tests/ -v

# Smoke test API
curl http://localhost:8000/health
```
