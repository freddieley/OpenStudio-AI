"""
Text-to-speech pipeline using Coqui XTTS v2.

Supports multilingual synthesis and zero-shot voice cloning.
"""
from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


class TTSPipeline:
    """
    XTTS v2 text-to-speech with voice cloning support.
    """

    def __init__(self, device: str = "cuda") -> None:
        self._device = device
        self._model: Optional[Any] = None

    def _load(self) -> None:
        if self._model is not None:
            return
        try:
            from TTS.api import TTS
            self._model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(self._device)
            logger.info("XTTS v2 loaded on %s", self._device)
        except Exception as exc:
            logger.error("Failed to load TTS model: %s", exc)
            raise

    async def synthesize(
        self,
        job: Any,
        text: str,
        voice_path: Optional[Path],
        language: str,
        speed: float,
        output_dir: Path,
    ) -> Path:
        loop = asyncio.get_event_loop()

        def _run() -> Path:
            self._load()
            assert self._model is not None

            job.progress = 0.1
            output_path = output_dir / f"tts_{int(time.time())}.wav"

            if voice_path and voice_path.exists():
                # Voice cloning mode
                self._model.tts_to_file(
                    text=text,
                    speaker_wav=str(voice_path),
                    language=language,
                    file_path=str(output_path),
                    speed=speed,
                )
            else:
                # Default speaker
                self._model.tts_to_file(
                    text=text,
                    language=language,
                    file_path=str(output_path),
                    speed=speed,
                )

            job.progress = 1.0
            return output_path

        return await loop.run_in_executor(None, _run)
