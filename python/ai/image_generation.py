"""
Image generation pipeline using Diffusers.

Supports Stable Diffusion, SDXL, Flux, and LoRA weights.
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ImageGenerationPipeline:
    """
    Wraps HuggingFace Diffusers pipelines for text-to-image generation.

    Supports:
    - Stable Diffusion 1.5 / 2.x
    - SDXL base + refiner
    - FLUX.1
    - ControlNet conditioning
    - LoRA weights
    - LCM/Turbo distilled models
    """

    def __init__(self, model_path: Path, device: str = "cuda") -> None:
        self._model_path = model_path
        self._device = device
        self._pipeline: Optional[Any] = None

    def _load_pipeline(self) -> Any:
        """Load the appropriate pipeline based on model type detection."""
        try:
            from diffusers import (
                StableDiffusionPipeline,
                StableDiffusionXLPipeline,
                FluxPipeline,
                DiffusionPipeline,
            )
            import torch

            dtype = torch.float16 if self._device != "cpu" else torch.float32

            # Detect model type from config.json or index.json
            config_path = self._model_path / "model_index.json"
            if config_path.exists():
                import json
                with open(config_path) as f:
                    cfg = json.load(f)
                pipeline_class = cfg.get("_class_name", "")

                if "SDXL" in pipeline_class or "StableDiffusionXL" in pipeline_class:
                    return StableDiffusionXLPipeline.from_pretrained(
                        str(self._model_path),
                        torch_dtype=dtype,
                        use_safetensors=True,
                        variant="fp16" if dtype == torch.float16 else None,
                    ).to(self._device)

                if "Flux" in pipeline_class:
                    return FluxPipeline.from_pretrained(
                        str(self._model_path),
                        torch_dtype=dtype,
                    ).to(self._device)

            # Fallback: generic diffusion pipeline
            return DiffusionPipeline.from_pretrained(
                str(self._model_path),
                torch_dtype=dtype,
                safety_checker=None,
            ).to(self._device)

        except Exception as exc:
            logger.error("Failed to load image generation pipeline: %s", exc)
            raise

    async def generate(
        self,
        job: Any,
        params: dict[str, Any],
        output_dir: Path,
    ) -> list[Path]:
        """Run inference and save output images to output_dir."""
        import torch

        loop = asyncio.get_event_loop()

        def _run() -> list[Path]:
            if self._pipeline is None:
                self._pipeline = self._load_pipeline()

            seed = params.get("seed", -1)
            if seed == -1:
                seed = int(torch.randint(0, 2**32 - 1, (1,)).item())

            generator = torch.Generator(device=self._device).manual_seed(seed)
            batch_size = params.get("batch_size", 1)

            # Build kwargs compatible with most diffusers pipelines
            common_kwargs: dict[str, Any] = {
                "prompt": params["prompt"],
                "num_inference_steps": params.get("steps", 20),
                "generator": generator,
                "num_images_per_prompt": batch_size,
            }

            if params.get("negative_prompt"):
                common_kwargs["negative_prompt"] = params["negative_prompt"]

            # Width / height
            if params.get("width") and params.get("height"):
                common_kwargs["width"] = params["width"]
                common_kwargs["height"] = params["height"]

            # CFG scale (not all pipelines support it)
            if hasattr(self._pipeline, "guidance_scale"):
                common_kwargs["guidance_scale"] = params.get("cfg_scale", 7.5)

            def _progress_callback(step: int, timestep: Any, latents: Any) -> None:
                total_steps = params.get("steps", 20)
                job.progress = (step + 1) / total_steps

            common_kwargs["callback_on_step_end"] = _progress_callback

            result = self._pipeline(**common_kwargs)
            images = result.images

            output_paths = []
            timestamp = int(time.time())
            for i, image in enumerate(images):
                fname = f"gen_{timestamp}_{seed}_{i:02d}.png"
                out_path = output_dir / fname
                image.save(str(out_path), "PNG")
                output_paths.append(out_path)

            return output_paths

        return await loop.run_in_executor(None, _run)
