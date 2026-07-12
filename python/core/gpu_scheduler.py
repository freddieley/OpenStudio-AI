"""
GPU scheduling and VRAM management for OpenStudio AI.

Tracks loaded models, estimates required VRAM, offloads models when
the budget is exceeded, and queues inference jobs to avoid OOM crashes.
"""
from __future__ import annotations

import asyncio
import logging
import threading
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

try:
    import torch
    _TORCH_AVAILABLE = True
except ImportError:
    _TORCH_AVAILABLE = False


@dataclass
class ModelEntry:
    model_id: str
    model_type: str
    vram_mb: int
    pipeline: Any  # the loaded pipeline object
    device: str
    last_used: float = field(default=0.0)
    in_use: bool = False


class GPUScheduler:
    """
    Manages GPU VRAM allocation for AI model pipelines.

    - Tracks all loaded models and their VRAM usage
    - Automatically offloads least-recently-used models to CPU or unloads them
    - Supports sequential execution of inference jobs to avoid concurrent OOM
    - Falls back gracefully to CPU when no GPU is available
    """

    def __init__(self, vram_budget_mb: int = 8192, device: str = "auto") -> None:
        self._vram_budget_mb = vram_budget_mb
        self._device = self._resolve_device(device)
        self._loaded: OrderedDict[str, ModelEntry] = OrderedDict()
        self._lock = asyncio.Lock()
        self._inference_semaphore = asyncio.Semaphore(1)  # serialize heavy inference
        logger.info(
            "GPUScheduler initialized — device=%s vram_budget=%dMB",
            self._device,
            vram_budget_mb,
        )

    @property
    def device(self) -> str:
        return self._device

    @property
    def is_gpu(self) -> bool:
        return self._device.startswith("cuda") or self._device == "mps"

    def _resolve_device(self, device: str) -> str:
        if device == "auto":
            if _TORCH_AVAILABLE:
                if torch.cuda.is_available():
                    return "cuda"
                if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                    return "mps"
            return "cpu"
        return device

    def get_available_vram_mb(self) -> int:
        """Return approximate available VRAM in MB."""
        if not _TORCH_AVAILABLE or not self._device.startswith("cuda"):
            return 0
        try:
            idx = int(self._device.split(":")[-1]) if ":" in self._device else 0
            free, total = torch.cuda.mem_get_info(idx)
            return free // (1024 * 1024)
        except Exception:
            return 0

    def get_total_vram_mb(self) -> int:
        """Return total VRAM on the current GPU in MB."""
        if not _TORCH_AVAILABLE or not self._device.startswith("cuda"):
            return 0
        try:
            idx = int(self._device.split(":")[-1]) if ":" in self._device else 0
            _, total = torch.cuda.mem_get_info(idx)
            return total // (1024 * 1024)
        except Exception:
            return 0

    def get_used_vram_mb(self) -> int:
        """Return VRAM used by all currently loaded models."""
        return sum(e.vram_mb for e in self._loaded.values())

    def get_gpu_info(self) -> list[dict]:
        """Return a list of GPU info dicts (for the /api/system/gpu endpoint)."""
        if not _TORCH_AVAILABLE or not torch.cuda.is_available():
            return []
        results = []
        for i in range(torch.cuda.device_count()):
            props = torch.cuda.get_device_properties(i)
            free, total = torch.cuda.mem_get_info(i)
            results.append(
                {
                    "index": i,
                    "name": props.name,
                    "vram_mb": total // (1024 * 1024),
                    "available_vram_mb": free // (1024 * 1024),
                    "backend": "cuda",
                }
            )
        return results

    async def acquire(
        self,
        model_id: str,
        model_type: str,
        vram_mb: int,
        loader: Callable[[], Any],
    ) -> Any:
        """
        Ensure a model is loaded and return its pipeline.

        If loading it would exceed the VRAM budget, least-recently-used models
        are offloaded first.
        """
        import time

        async with self._lock:
            if model_id in self._loaded:
                entry = self._loaded[model_id]
                entry.last_used = time.monotonic()
                self._loaded.move_to_end(model_id)
                logger.debug("Model cache hit: %s", model_id)
                return entry.pipeline

            # Ensure there is enough VRAM
            await self._make_room(vram_mb)

            logger.info("Loading model %s (%dMB VRAM) on %s", model_id, vram_mb, self._device)
            pipeline = await asyncio.get_event_loop().run_in_executor(None, loader)

            entry = ModelEntry(
                model_id=model_id,
                model_type=model_type,
                vram_mb=vram_mb,
                pipeline=pipeline,
                device=self._device,
                last_used=time.monotonic(),
            )
            self._loaded[model_id] = entry
            logger.info(
                "Model loaded: %s — VRAM usage: %dMB / %dMB",
                model_id,
                self.get_used_vram_mb(),
                self._vram_budget_mb,
            )
            return pipeline

    async def release(self, model_id: str) -> None:
        """Mark a model as no longer actively in use (keeps it in cache)."""
        async with self._lock:
            if model_id in self._loaded:
                self._loaded[model_id].in_use = False

    async def evict(self, model_id: str) -> None:
        """Explicitly remove a model from VRAM."""
        async with self._lock:
            if model_id in self._loaded:
                await self._offload(model_id)

    async def evict_all(self) -> None:
        """Remove all models from VRAM."""
        async with self._lock:
            for model_id in list(self._loaded.keys()):
                await self._offload(model_id)

    async def _make_room(self, required_mb: int) -> None:
        """Offload LRU models until there is enough VRAM for the requested model."""
        if self.get_used_vram_mb() + required_mb <= self._vram_budget_mb:
            return

        # Evict LRU models that are not currently in use
        for model_id, entry in list(self._loaded.items()):
            if entry.in_use:
                continue
            logger.info(
                "Evicting model %s to free %dMB VRAM", entry.model_id, entry.vram_mb
            )
            await self._offload(model_id)
            if self.get_used_vram_mb() + required_mb <= self._vram_budget_mb:
                return

        if self.get_used_vram_mb() + required_mb > self._vram_budget_mb:
            logger.warning(
                "Cannot fully satisfy VRAM budget for %dMB — proceeding with CPU offload",
                required_mb,
            )

    async def _offload(self, model_id: str) -> None:
        """Move a model off GPU and delete its pipeline object."""
        entry = self._loaded.pop(model_id, None)
        if entry is None:
            return

        def _do_offload() -> None:
            pipeline = entry.pipeline
            # Try to move to CPU for graceful offload
            if _TORCH_AVAILABLE and hasattr(pipeline, "to"):
                try:
                    pipeline.to("cpu")
                except Exception:
                    pass
            del pipeline
            if _TORCH_AVAILABLE and torch.cuda.is_available():
                torch.cuda.empty_cache()

        await asyncio.get_event_loop().run_in_executor(None, _do_offload)
        logger.info("Model offloaded: %s", model_id)

    async def run_inference(self, model_id: str, fn: Callable[[], Any]) -> Any:
        """
        Run an inference function with the global inference semaphore held.
        This prevents concurrent OOM crashes.
        """
        async with self._inference_semaphore:
            if model_id in self._loaded:
                self._loaded[model_id].in_use = True
            try:
                result = await asyncio.get_event_loop().run_in_executor(None, fn)
                return result
            finally:
                if model_id in self._loaded:
                    self._loaded[model_id].in_use = False
