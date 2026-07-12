"""
Model manager for OpenStudio AI.

Handles model discovery, registration, downloading, and lifecycle management.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, AsyncGenerator, Optional

import httpx

from core.config import Settings
from core.database import Database
from core.job_queue import Job, JobQueue

logger = logging.getLogger(__name__)

# Built-in model registry (curated list of open-source models)
BUILTIN_REGISTRY: list[dict[str, Any]] = [
    {
        "id": "sdxl-base-1.0",
        "name": "Stable Diffusion XL Base 1.0",
        "type": "image-generation",
        "variant": "full",
        "description": "The full SDXL base model at 1024×1024 resolution.",
        "author": "Stability AI",
        "license": "CreativeML Open RAIL++-M",
        "version": "1.0.0",
        "size_bytes": 6_938_000_000,
        "vram_mb": 8192,
        "download_url": "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0",
        "tags": ["image-generation", "sdxl", "base"],
    },
    {
        "id": "sdxl-turbo",
        "name": "SDXL-Turbo",
        "type": "image-generation",
        "variant": "distilled",
        "description": "Distilled SDXL model for fast 1-step image generation.",
        "author": "Stability AI",
        "license": "SDXL-Turbo Research License",
        "version": "1.0.0",
        "size_bytes": 6_900_000_000,
        "vram_mb": 8192,
        "download_url": "https://huggingface.co/stabilityai/sdxl-turbo",
        "tags": ["image-generation", "sdxl", "turbo", "fast"],
    },
    {
        "id": "flux-schnell",
        "name": "FLUX.1 [schnell]",
        "type": "image-generation",
        "variant": "schnell",
        "description": "FLUX.1 schnell — fast open-source text-to-image model.",
        "author": "Black Forest Labs",
        "license": "Apache 2.0",
        "version": "1.0.0",
        "size_bytes": 23_800_000_000,
        "vram_mb": 16384,
        "download_url": "https://huggingface.co/black-forest-labs/FLUX.1-schnell",
        "tags": ["image-generation", "flux", "fast"],
    },
    {
        "id": "whisper-base",
        "name": "Whisper Base",
        "type": "speech-recognition",
        "variant": "base",
        "description": "OpenAI Whisper base model for speech recognition and transcription.",
        "author": "OpenAI",
        "license": "MIT",
        "version": "1.0.0",
        "size_bytes": 145_000_000,
        "vram_mb": 1024,
        "download_url": "https://huggingface.co/openai/whisper-base",
        "tags": ["speech-recognition", "whisper", "transcription"],
    },
    {
        "id": "whisper-large-v3",
        "name": "Whisper Large v3",
        "type": "speech-recognition",
        "variant": "large",
        "description": "OpenAI Whisper large-v3, highest accuracy speech recognition.",
        "author": "OpenAI",
        "license": "MIT",
        "version": "3.0.0",
        "size_bytes": 1_550_000_000,
        "vram_mb": 4096,
        "download_url": "https://huggingface.co/openai/whisper-large-v3",
        "tags": ["speech-recognition", "whisper", "high-accuracy"],
    },
    {
        "id": "real-esrgan-x4plus",
        "name": "Real-ESRGAN x4plus",
        "type": "upscaling",
        "variant": "x4plus",
        "description": "Real-ESRGAN for general image upscaling (4x).",
        "author": "xinntao",
        "license": "BSD 3-Clause",
        "version": "1.0.0",
        "size_bytes": 67_000_000,
        "vram_mb": 2048,
        "download_url": "https://github.com/xinntao/Real-ESRGAN",
        "tags": ["upscaling", "esrgan", "4x"],
    },
    {
        "id": "u2net-rembg",
        "name": "U-2-Net (Background Removal)",
        "type": "background-removal",
        "variant": "u2net",
        "description": "U-2-Net for accurate background removal.",
        "author": "xuebinqin",
        "license": "Apache 2.0",
        "version": "1.0.0",
        "size_bytes": 176_000_000,
        "vram_mb": 2048,
        "download_url": "https://huggingface.co/skytnt/anime-seg",
        "tags": ["background-removal", "segmentation"],
    },
    {
        "id": "xtts-v2",
        "name": "XTTS v2",
        "type": "tts",
        "variant": "v2",
        "description": "Coqui XTTS v2 — multilingual TTS with voice cloning.",
        "author": "Coqui",
        "license": "Coqui Public Model License",
        "version": "2.0.0",
        "size_bytes": 1_800_000_000,
        "vram_mb": 4096,
        "download_url": "https://huggingface.co/coqui/XTTS-v2",
        "tags": ["tts", "voice-cloning", "multilingual"],
    },
    {
        "id": "llama-3.1-8b-gguf",
        "name": "Llama 3.1 8B (Q4_K_M)",
        "type": "llm",
        "variant": "q4_k_m",
        "description": "Meta Llama 3.1 8B quantized to 4-bit for local inference.",
        "author": "Meta / Bartowski",
        "license": "Llama 3.1 Community License",
        "version": "3.1.0",
        "size_bytes": 4_900_000_000,
        "vram_mb": 6144,
        "download_url": "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
        "tags": ["llm", "llama", "text-generation", "quantized"],
    },
]


class ModelManager:
    """Manages model registration, downloading, and installation."""

    def __init__(self, settings: Settings, db: Database, job_queue: JobQueue) -> None:
        self._settings = settings
        self._db = db
        self._job_queue = job_queue
        self._models_dir = settings.models_dir

    async def initialize(self) -> None:
        """Seed the database with the built-in registry."""
        self._models_dir.mkdir(parents=True, exist_ok=True)
        for entry in BUILTIN_REGISTRY:
            existing = await self._db.fetchone(
                "SELECT id FROM model_registry WHERE id = ?", (entry["id"],)
            )
            if not existing:
                await self._db.execute(
                    """INSERT INTO model_registry (
                        id, name, type, variant, description, author, license,
                        version, size_bytes, vram_mb, download_url, tags, metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        entry["id"], entry["name"], entry["type"], entry.get("variant", "base"),
                        entry.get("description", ""), entry.get("author", ""),
                        entry.get("license", ""), entry.get("version", "1.0.0"),
                        entry.get("size_bytes", 0), entry.get("vram_mb", 0),
                        entry.get("download_url", ""),
                        json.dumps(entry.get("tags", [])),
                        json.dumps(entry.get("metadata", {})),
                    ),
                )
        logger.info("Model registry initialized with %d entries", len(BUILTIN_REGISTRY))

    async def list_models(
        self,
        model_type: Optional[str] = None,
        installed_only: bool = False,
    ) -> list[dict[str, Any]]:
        sql = "SELECT * FROM model_registry WHERE 1=1"
        params: list[Any] = []
        if model_type:
            sql += " AND type = ?"
            params.append(model_type)
        if installed_only:
            sql += " AND installed = 1"
        sql += " ORDER BY name ASC"
        return await self._db.fetchall(sql, tuple(params))

    async def get_model(self, model_id: str) -> Optional[dict[str, Any]]:
        return await self._db.fetchone(
            "SELECT * FROM model_registry WHERE id = ?", (model_id,)
        )

    async def install_model(
        self, model_id: str, install_path: Optional[str] = None
    ) -> Job:
        """Start a background job to download and install a model."""
        model = await self.get_model(model_id)
        if not model:
            raise ValueError(f"Model '{model_id}' not found in registry")

        target_dir = Path(install_path) if install_path else self._models_dir / model["type"] / model_id
        target_dir.mkdir(parents=True, exist_ok=True)

        async def _install(job: Job) -> None:
            await self._download_model(job, model, target_dir)
            # Mark as installed in DB
            await self._db.execute(
                "UPDATE model_registry SET installed = 1, install_path = ?, updated_at = datetime('now') WHERE id = ?",
                (str(target_dir), model_id),
            )
            job.output_files = [str(target_dir)]

        job = await self._job_queue.submit_with_coro(
            job_type="model-install",
            coro_fn=_install,
            input_params={"model_id": model_id, "install_path": str(target_dir)},
            model_id=model_id,
        )
        return job

    async def uninstall_model(self, model_id: str) -> None:
        """Delete model files and mark as uninstalled."""
        model = await self.get_model(model_id)
        if not model:
            raise ValueError(f"Model '{model_id}' not found")

        if model.get("install_path"):
            install_path = Path(model["install_path"])
            if install_path.exists():
                shutil.rmtree(install_path, ignore_errors=True)

        await self._db.execute(
            "UPDATE model_registry SET installed = 0, install_path = NULL, updated_at = datetime('now') WHERE id = ?",
            (model_id,),
        )
        logger.info("Model uninstalled: %s", model_id)

    async def get_install_path(self, model_id: str) -> Optional[Path]:
        """Return the install path for a model, or None if not installed."""
        model = await self.get_model(model_id)
        if model and model.get("install_path"):
            return Path(model["install_path"])
        return None

    async def _download_model(
        self,
        job: Job,
        model: dict[str, Any],
        target_dir: Path,
    ) -> None:
        """
        Download a model from HuggingFace Hub using huggingface_hub snapshot_download
        (preferred) or a direct URL as fallback.
        """
        download_url: str = model.get("download_url", "")

        if "huggingface.co/" in download_url:
            repo_id = download_url.replace("https://huggingface.co/", "").rstrip("/")
            await self._download_hf(job, repo_id, target_dir)
        elif download_url.startswith("http"):
            await self._download_direct(job, download_url, target_dir)
        else:
            raise ValueError(f"Cannot download model: no valid download URL for {model['id']}")

    async def _download_hf(self, job: Job, repo_id: str, target_dir: Path) -> None:
        """Download from HuggingFace Hub."""
        from huggingface_hub import snapshot_download

        def _do_download() -> str:
            return snapshot_download(
                repo_id=repo_id,
                local_dir=str(target_dir),
                token=self._settings.hf_token,
                ignore_patterns=["*.msgpack", "flax_model*", "tf_model*"],
            )

        logger.info("Downloading from HF Hub: %s → %s", repo_id, target_dir)
        job.progress = 0.05
        await asyncio.get_event_loop().run_in_executor(None, _do_download)
        job.progress = 1.0

    async def _download_direct(
        self, job: Job, url: str, target_dir: Path
    ) -> None:
        """Stream download a file from a direct URL."""
        filename = url.split("/")[-1].split("?")[0]
        dest = target_dir / filename

        async with httpx.AsyncClient(timeout=None, follow_redirects=True) as client:
            async with client.stream("GET", url) as response:
                response.raise_for_status()
                total = int(response.headers.get("content-length", 0))
                downloaded = 0

                with open(dest, "wb") as f:
                    async for chunk in response.aiter_bytes(chunk_size=65536):
                        if job.cancel_event.is_set():
                            raise asyncio.CancelledError("Job cancelled")
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total > 0:
                            job.progress = downloaded / total

        logger.info("Downloaded: %s (%d bytes)", dest, downloaded)
