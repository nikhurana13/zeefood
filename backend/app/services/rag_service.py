"""
ZEfood Backend — RAG Chatbot Service
Retrieval-Augmented Generation pipeline using FAISS + Google Gemini
"""
from __future__ import annotations
import os
import uuid
import logging
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class RAGService:
    """
    RAG pipeline for ZEfood AI Customer Support.

    Components:
        1. FAISS vector store (local) — stores embeddings of knowledge base docs
        2. SentenceTransformers — for embedding queries and documents
        3. Google Gemini (or OpenAI) — generates responses grounded in retrieved context
        4. Escalation logic — confidence threshold below which we flag for human handoff
    """

    def __init__(self):
        self.index = None
        self.documents: list[str] = []
        self.embedder = None
        self.llm = None
        self._ready = False
        self._CONFIDENCE_THRESHOLD = 0.35

    def initialize(self, knowledge_base_path: str, faiss_index_path: str,
                   gemini_api_key: str, gemini_model: str) -> None:
        """Load or build FAISS index from knowledge base documents."""
        try:
            import faiss
            import numpy as np
            from sentence_transformers import SentenceTransformer
            import google.generativeai as genai

            # Load embedding model
            logger.info("Loading sentence-transformer for RAG embeddings...")
            self.embedder = SentenceTransformer("all-MiniLM-L6-v2")

            # Load knowledge base
            kb_path = Path(knowledge_base_path)
            self.documents = []
            if kb_path.exists():
                for fp in kb_path.glob("*.txt"):
                    self.documents.extend(fp.read_text(encoding="utf-8").split("\n\n"))
            else:
                # Seed with default FAQ content
                self.documents = self._get_default_knowledge_base()
                kb_path.mkdir(parents=True, exist_ok=True)
                (kb_path / "default_faq.txt").write_text(
                    "\n\n".join(self.documents), encoding="utf-8"
                )

            # Filter empty chunks
            self.documents = [d.strip() for d in self.documents if len(d.strip()) > 20]

            # Build or load FAISS index
            idx_path = Path(faiss_index_path)
            embeddings_file = idx_path / "embeddings.npy"
            index_file = idx_path / "index.faiss"

            if index_file.exists() and embeddings_file.exists():
                logger.info("Loading existing FAISS index...")
                self.index = faiss.read_index(str(index_file))
            else:
                logger.info(f"Building FAISS index from {len(self.documents)} chunks...")
                idx_path.mkdir(parents=True, exist_ok=True)
                embeddings = self.embedder.encode(self.documents, show_progress_bar=False)
                embeddings = np.array(embeddings, dtype="float32")
                dim = embeddings.shape[1]
                self.index = faiss.IndexFlatIP(dim)  # Inner product (cosine-like with normalized)
                faiss.normalize_L2(embeddings)
                self.index.add(embeddings)
                faiss.write_index(self.index, str(index_file))
                np.save(str(embeddings_file), embeddings)

            # Setup LLM
            genai.configure(api_key=gemini_api_key)
            self.llm = genai.GenerativeModel(gemini_model)
            self._ready = True
            logger.info("✅ RAG service initialised successfully")

        except ImportError as e:
            logger.warning(f"RAG dependencies not installed: {e}. Running in stub mode.")
        except Exception as e:
            logger.error(f"RAG init error: {e}. Running in stub mode.")

    def query(self, user_message: str, order_context: Optional[dict] = None,
              top_k: int = 3) -> dict:
        """
        Run a RAG query.
        Returns: {"response": str, "escalate": bool, "sources": list[str]}
        """
        if not self._ready:
            return self._stub_response(user_message)

        try:
            import numpy as np

            # Embed query
            query_emb = self.embedder.encode([user_message], show_progress_bar=False)
            query_emb = np.array(query_emb, dtype="float32")
            import faiss
            faiss.normalize_L2(query_emb)

            # Retrieve top-k chunks
            distances, indices = self.index.search(query_emb, top_k)
            scores = distances[0].tolist()
            top_chunks = [self.documents[i] for i in indices[0] if i < len(self.documents)]

            # Build context
            context = "\n\n---\n\n".join(top_chunks)
            order_ctx_str = ""
            if order_context:
                order_ctx_str = (
                    f"\n\nOrder Context:\nOrder ID: {order_context.get('id', 'N/A')}\n"
                    f"Status: {order_context.get('status', 'N/A')}\n"
                    f"Items: {order_context.get('items', [])}"
                )

            prompt = f"""You are ZEfood's AI customer support assistant. You are helpful, concise, and empathetic.
Answer the customer's question using ONLY the provided context. If you cannot answer from the context, say so honestly.

Context:
{context}
{order_ctx_str}

Customer question: {user_message}

Answer:"""

            response = self.llm.generate_content(prompt)
            answer = response.text.strip()

            # Determine escalation
            avg_score = sum(scores) / len(scores) if scores else 0
            escalate = avg_score < self._CONFIDENCE_THRESHOLD or any(
                kw in user_message.lower()
                for kw in ["refund", "complaint", "fraud", "missing", "wrong order", "human", "manager"]
            )

            return {
                "response": answer,
                "escalate": escalate,
                "sources": [chunk[:80] + "..." for chunk in top_chunks],
            }

        except Exception as e:
            logger.error(f"RAG query error: {e}")
            return self._stub_response(user_message)

    def _stub_response(self, message: str) -> dict:
        """Fallback when RAG is not initialised."""
        return {
            "response": (
                "Hello! I'm ZEfood's support assistant. I'm currently in limited mode. "
                "For urgent issues, please contact our support team directly or I can escalate this for you."
            ),
            "escalate": True,
            "sources": [],
        }

    def _get_default_knowledge_base(self) -> list[str]:
        return [
            "ZEfood is a food delivery and hotel pantry service platform. We serve restaurants, hotels, and grocery marts.",
            "To cancel an order, go to Order History > Select Order > Cancel. Cancellations are only available within 5 minutes of placing the order and before the restaurant accepts it.",
            "Refunds are processed within 5-7 business days to the original payment method. UPI refunds typically take 1-3 days.",
            "Delivery typically takes 30-60 minutes depending on your location and restaurant preparation time. You can track your order in real-time in the app.",
            "If your order is wrong or has missing items, please report it through the Order Issue button in Order History. We will initiate a refund or replacement.",
            "ZEfood accepts payments via Razorpay: UPI, credit/debit cards, net banking, and digital wallets.",
            "Room service orders for hotel guests are delivered directly to your room. Please ensure you enter the correct room number at checkout.",
            "To change your delivery address, go to Profile > Addresses. Note: You cannot change the delivery address of an order already placed.",
            "Our customer support is available 24/7 via this chat or you can call our helpline at 1800-ZEFOOD.",
            "If a restaurant is closed or unavailable, you will see a 'Currently Closed' badge on their listing. Try ordering from a different restaurant.",
            "ZEfood loyalty points are earned on every order. 1 point = ₹1. Points can be redeemed at checkout.",
            "For hotel guests, the pantry service is available 24/7. Room service meals are available from 7 AM to 11 PM.",
            "If your delivery partner has not arrived within the estimated time, please use the Track Order feature or contact us via this chat.",
            "To leave a review, go to Order History > Completed Orders > Rate & Review. You can submit text or audio reviews.",
        ]


# Singleton
rag_service = RAGService()
