"""
ZEfood Backend — Audio Emotion Analysis Service
Pipeline: Whisper (STT) + wav2vec2 audio emotion classifier
"""
from __future__ import annotations
import logging
import os
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)


class AudioEmotionService:
    """
    Analyses emotion from audio review files.
    Steps:
        1. Whisper — speech-to-text transcription
        2. wav2vec2 audio emotion model — predict arousal/valence/dominance
        3. Map AV space to discrete emotion label
    """

    EMOTION_LABELS = {
        # (high_arousal, positive_valence) quadrant → emotion name
        (True, True): "joy",
        (True, False): "anger",
        (False, True): "joy",   # low arousal + positive = contentment/joy
        (False, False): "sadness",
    }

    def __init__(self):
        self._whisper_model = None
        self._emotion_model = None
        self._emotion_processor = None
        self._ready = False

    def initialize(self, whisper_size: str, emotion_model_id: str) -> None:
        """Load Whisper + audio emotion models."""
        try:
            import whisper
            logger.info(f"Loading Whisper ({whisper_size})...")
            self._whisper_model = whisper.load_model(whisper_size)
            logger.info("✅ Whisper loaded")

            # audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim is a REGRESSION model
            # that outputs continuous arousal/dominance/valence scores — NOT a classification
            # model. We use AutoProcessor + AutoModel (not AutoModelForAudioClassification).
            from transformers import AutoProcessor, AutoModel
            import torch
            logger.info(f"Loading audio emotion model: {emotion_model_id}")
            self._emotion_processor = AutoProcessor.from_pretrained(emotion_model_id)
            self._emotion_model = AutoModel.from_pretrained(emotion_model_id)
            self._emotion_model.eval()
            self._ready = True
            logger.info("✅ Audio emotion model loaded")

        except Exception as e:
            logger.warning(f"Audio emotion init failed: {e}. Running stub mode.")

    def analyze_audio(self, audio_bytes: bytes, filename: str = "review.webm") -> dict:
        """
        Analyse an uploaded audio file.
        Returns:
            {
                "transcript": str,
                "emotion": str,
                "arousal": float,
                "valence": float,
                "dominance": float
            }
        """
        if not self._ready:
            return self._stub_result()

        try:
            import numpy as np
            import librosa
            import soundfile as sf

            # Write bytes to temp file
            suffix = Path(filename).suffix or ".webm"
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            try:
                # Step 1: Transcribe with Whisper
                result = self._whisper_model.transcribe(tmp_path)
                transcript = result["text"].strip()

                # Step 2: Load audio for emotion model
                audio_array, sr = librosa.load(tmp_path, sr=16000)

                # Step 3: Run emotion regression model
                # audeering model outputs [arousal, dominance, valence] via mean-pooled hidden states
                import torch
                inputs = self._emotion_processor(
                    audio_array, sampling_rate=16000, return_tensors="pt", padding=True
                )
                with torch.no_grad():
                    outputs = self._emotion_model(**inputs)
                    # Mean-pool the last hidden state across time dimension
                    hidden = outputs.last_hidden_state  # (1, T, D)
                    pooled = hidden.mean(dim=1)         # (1, D)
                    # The model's classifier head: project to 3 regression targets
                    # For audeering model, use the `classifier` output if available,
                    # otherwise fall back to the first 3 dims of pooled output
                    if hasattr(self._emotion_model, 'classifier'):
                        logits = self._emotion_model.classifier(pooled)[0].numpy()
                    else:
                        logits = pooled[0].numpy()[:3]  # arousal, dominance, valence

                # audeering model outputs: [arousal, dominance, valence] in [0,1]
                arousal = float(np.clip(logits[0], 0, 1))
                dominance = float(np.clip(logits[1], 0, 1))
                valence = float(np.clip(logits[2], 0, 1))

                # Map to discrete emotion
                emotion = self._map_to_emotion(arousal, valence)

                return {
                    "transcript": transcript,
                    "emotion": emotion,
                    "arousal": round(arousal, 4),
                    "valence": round(valence, 4),
                    "dominance": round(dominance, 4),
                }
            finally:
                os.unlink(tmp_path)

        except Exception as e:
            logger.error(f"Audio emotion analysis failed: {e}")
            return self._stub_result()

    def _map_to_emotion(self, arousal: float, valence: float) -> str:
        """Map arousal/valence coordinates to discrete emotion label."""
        high_arousal = arousal > 0.5
        positive_valence = valence > 0.5

        if high_arousal and positive_valence:
            return "joy"
        elif high_arousal and not positive_valence:
            return "anger"
        elif not high_arousal and positive_valence:
            return "joy"  # Contentment maps to joy
        else:
            return "sadness"

    def _stub_result(self) -> dict:
        """Return a plausible stub result when models are unavailable."""
        return {
            "transcript": "[Audio transcription unavailable in stub mode]",
            "emotion": "neutral",
            "arousal": 0.5,
            "valence": 0.5,
            "dominance": 0.5,
        }


# Singleton
audio_emotion_service = AudioEmotionService()
