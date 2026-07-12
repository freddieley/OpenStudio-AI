"""
Background removal pipeline using rembg.
"""
from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class BackgroundRemovalPipeline:
    """
    Removes image backgrounds using rembg (U2Net, BiRefNet, etc.).
    """

    def __init__(self, model_name: str = "u2net") -> None:
        self._model_name = model_name
        self._session: Any = None

    def _load(self) -> None:
        if self._session is not None:
            return
        try:
            from rembg import new_session
            self._session = new_session(self._model_name)
            logger.info("rembg session loaded: %s", self._model_name)
        except Exception as exc:
            logger.error("Failed to load rembg: %s", exc)
            raise

    async def remove_background(
        self,
        job: Any,
        image_path: Path,
        output_dir: Path,
    ) -> Path:
        loop = asyncio.get_event_loop()

        def _run() -> Path:
            from rembg import remove
            from PIL import Image

            self._load()
            job.progress = 0.1

            input_img = Image.open(image_path)
            job.progress = 0.3

            output_img = remove(input_img, session=self._session)
            job.progress = 0.9

            stem = image_path.stem
            out_path = output_dir / f"{stem}_nobg_{int(time.time())}.png"
            output_img.save(str(out_path), "PNG")
            job.progress = 1.0
            return out_path

        return await loop.run_in_executor(None, _run)
