"""
Speech recognition pipeline using Faster Whisper.
"""
from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


class SpeechRecognitionPipeline:
    """
    Wraps faster-whisper for local speech transcription.

    Supports:
    - All Whisper model sizes (tiny, base, small, medium, large-v3)
    - Word-level timestamps
    - Language detection
    - CTranslate2 quantization (float16, int8)
    """

    def __init__(
        self,
        model_size: str = "base",
        device: str = "auto",
        compute_type: str = "float16",
    ) -> None:
        self._model_size = model_size
        self._device = self._resolve_device(device)
        self._compute_type = compute_type if self._device != "cpu" else "int8"
        self._model: Optional[Any] = None

    def _resolve_device(self, device: str) -> str:
        if device == "auto":
            try:
                import torch
                return "cuda" if torch.cuda.is_available() else "cpu"
            except ImportError:
                return "cpu"
        return device

    def _load(self) -> None:
        if self._model is not None:
            return
        try:
            from faster_whisper import WhisperModel
            self._model = WhisperModel(
                self._model_size,
                device=self._device,
                compute_type=self._compute_type,
            )
            logger.info("Whisper model loaded: %s on %s", self._model_size, self._device)
        except Exception as exc:
            logger.error("Failed to load Whisper model: %s", exc)
            raise

    async def transcribe(
        self,
        job: Any,
        audio_path: Path,
        language: Optional[str] = None,
    ) -> dict[str, Any]:
        loop = asyncio.get_event_loop()

        def _run() -> dict[str, Any]:
            self._load()
            assert self._model is not None

            job.progress = 0.1
            segments_gen, info = self._model.transcribe(
                str(audio_path),
                language=language if language != "auto" else None,
                word_timestamps=True,
                vad_filter=True,
            )

            segments = []
            full_text_parts = []
            for segment in segments_gen:
                seg = {
                    "id": segment.id,
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text.strip(),
                    "words": [
                        {"word": w.word, "start": w.start, "end": w.end, "probability": w.probability}
                        for w in (segment.words or [])
                    ],
                    "avg_logprob": segment.avg_logprob,
                    "no_speech_prob": segment.no_speech_prob,
                }
                segments.append(seg)
                full_text_parts.append(segment.text.strip())
                job.progress = min(0.9, job.progress + 0.05)

            job.progress = 1.0
            return {
                "text": " ".join(full_text_parts),
                "language": info.language,
                "language_probability": info.language_probability,
                "duration": info.duration,
                "segments": segments,
            }

        return await loop.run_in_executor(None, _run)
