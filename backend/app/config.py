"""
ZEfood Backend — Application Settings
Loads configuration from environment variables / .env file.
Updated to use Pydantic v2 syntax (SettingsConfigDict + validation_alias).
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    """
    All settings are loaded from environment variables.
    Field names are snake_case; env vars are UPPER_SNAKE_CASE automatically.
    pydantic-settings maps them by uppercasing the field name.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,  # APP_ENV matches app_env
    )

    # ── App ──────────────────────────────────────────────────
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    debug: bool = True
    cors_origins: str = "http://localhost:3000,http://localhost:3001,http://localhost:3002"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    # ── Firebase ─────────────────────────────────────────────
    firebase_user_app_credentials: str = Field(...)
    firebase_staff_credentials: str = Field(...)
    firebase_admin_credentials: str = Field(...)

    firebase_user_app_project_id: str = Field(...)
    firebase_staff_project_id: str = Field(...)
    firebase_admin_project_id: str = Field(...)

    user_app_storage_bucket: str = "zeefood-c72cd.appspot.com"

    # ── JWT ──────────────────────────────────────────────────
    jwt_secret_key: str = "changeme-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080

    # ── LLM ─────────────────────────────────────────────────
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    # ── Razorpay ─────────────────────────────────────────────
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    # ── RAG / FAISS ───────────────────────────────────────────
    faiss_index_path: str = "./data/faiss_index"
    knowledge_base_path: str = "./data/knowledge_base"

    # ── HuggingFace Models ───────────────────────────────────
    sentiment_model_id: str = "j-hartmann/emotion-english-distilroberta-base"
    # NOTE: audeering model is a regression model — loaded with AutoModel, not AutoModelForAudioClassification
    audio_emotion_model_id: str = "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"
    whisper_model_size: str = "base"

    @field_validator("jwt_secret_key")
    @classmethod
    def warn_default_secret(cls, v: str) -> str:
        if v == "changeme-secret":
            import warnings
            warnings.warn(
                "JWT_SECRET_KEY is set to the default value. "
                "Set a strong secret in your .env file before deploying!",
                stacklevel=2,
            )
        return v


@lru_cache()
def get_settings() -> Settings:
    return Settings()
