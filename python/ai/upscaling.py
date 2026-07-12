"""
Image upscaling pipeline using Real-ESRGAN via the basicsr/realesrgan library.
"""
from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


class UpscalingPipeline:
    """Real-ESRGAN upscaling pipeline."""

    def __init__(self, device: str = "cuda") -> None:
        self._device = device
        self._upsampler: Optional[Any] = None

    def _load(self, scale: int = 4) -> None:
        try:
            from realesrgan import RealESRGANer
            from basicsr.archs.rrdbnet_arch import RRDBNet
            import torch

            model = RRDBNet(
                num_in_ch=3, num_out_ch=3, num_feat=64,
                num_block=23, num_grow_ch=32, scale=scale,
            )
            self._upsampler = RealESRGANer(
                scale=scale,
                model_path=None,  # will auto-download
                model=model,
                tile=512,
                tile_pad=10,
                pre_pad=0,
                half=self._device != "cpu",
                device=torch.device(self._device),
            )
        except ImportError:
            # Fallback: use PIL-based Lanczos upscaling
            logger.warning("Real-ESRGAN not available, using PIL Lanczos fallback")
            self._upsampler = None

    async def upscale(
        self,
        job: Any,
        image_path: Path,
        scale: int,
        output_dir: Path,
    ) -> Path:
        loop = asyncio.get_event_loop()

        def _run() -> Path:
            import numpy as np
            from PIL import Image

            img = Image.open(image_path).convert("RGB")
            job.progress = 0.2

            if self._upsampler is None:
                self._load(scale)

            if self._upsampler is not None:
                import cv2
                img_np = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
                output_np, _ = self._upsampler.enhance(img_np, outscale=scale)
                output_img = Image.fromarray(cv2.cvtColor(output_np, cv2.COLOR_BGR2RGB))
            else:
                # PIL fallback
                new_w = img.width * scale
                new_h = img.height * scale
                output_img = img.resize((new_w, new_h), Image.LANCZOS)

            job.progress = 0.9
            stem = image_path.stem
            out_path = output_dir / f"{stem}_x{scale}_{int(time.time())}.png"
            output_img.save(str(out_path), "PNG")
            job.progress = 1.0
            return out_path

        return await loop.run_in_executor(None, _run)
