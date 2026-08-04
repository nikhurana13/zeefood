"""
ZEfood Backend — Chatbot Router
RAG-powered AI customer support with escalation to human agents
"""
from fastapi import APIRouter, Depends, HTTPException
from app.models.schemas import ChatMessage, ChatResponse, EscalateRequest, MessageResponse
from app.services.rag_service import rag_service
from app.services.firebase import get_user_db, doc_to_dict
from app.middleware.auth_middleware import get_current_user
import uuid
import logging
from datetime import datetime, timezone

router = APIRouter(prefix="/chatbot", tags=["Chatbot"])
logger = logging.getLogger(__name__)


@router.post("/message", response_model=ChatResponse)
async def send_message(payload: ChatMessage, user: dict = Depends(get_current_user)):
    """
    Process a user message through the RAG pipeline.
    Returns AI-generated response grounded in the knowledge base,
    plus an escalation flag if confidence is low or keywords trigger handoff.
    """
    # Optionally fetch order context
    order_context = None
    if payload.order_id:
        try:
            db = get_user_db()
            doc = db.collection("orders").document(payload.order_id).get()
            if doc.exists:
                order_context = doc_to_dict(doc)
        except Exception:
            pass

    # Run RAG query
    result = rag_service.query(
        user_message=payload.message,
        order_context=order_context,
    )

    session_id = payload.session_id or str(uuid.uuid4())

    # Log conversation to Firestore
    try:
        db = get_user_db()
        db.collection("chat_sessions").document(session_id).collection("messages").add({
            "user_message": payload.message,
            "bot_response": result["response"],
            "escalated": result.get("escalate", False),
            "user_id": user["uid"],
            "timestamp": datetime.now(timezone.utc),
        })
    except Exception as e:
        logger.warning(f"Chat log failed: {e}")

    return ChatResponse(
        response=result["response"],
        session_id=session_id,
        escalate=result.get("escalate", False),
        sources=result.get("sources", []),
    )


@router.post("/escalate", response_model=MessageResponse)
async def escalate_to_human(payload: EscalateRequest, user: dict = Depends(get_current_user)):
    """
    Mark a chat session as escalated to human support.
    In production this would create a support ticket in a CRM.
    """
    try:
        db = get_user_db()
        db.collection("support_tickets").add({
            "session_id": payload.session_id,
            "user_id": user["uid"],
            "reason": payload.reason,
            "status": "open",
            "created_at": datetime.now(timezone.utc),
        })
    except Exception as e:
        logger.warning(f"Escalation log failed: {e}")

    return MessageResponse(
        message="Your request has been escalated to our support team. "
                "A representative will contact you within 1 hour."
    )


@router.get("/sessions/{session_id}/history")
async def get_chat_history(session_id: str, user: dict = Depends(get_current_user)):
    """Get all messages in a chat session."""
    db = get_user_db()
    messages = db.collection("chat_sessions").document(session_id).collection("messages") \
                  .order_by("timestamp").stream()
    return [{"id": m.id, **m.to_dict()} for m in messages]
