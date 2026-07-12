"""
Generation API routes — image, video, speech, TTS, etc.
Each route submits a job to the job queue and returns the job ID.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ai.image_generation import ImageGenerationPipeline
from ai.speech_recognition import SpeechRecognitionPipeline
from ai.tts import TTSPipeline
from ai.upscaling import UpscalingPipeline
from ai.background_removal import BackgroundRemovalPipeline
from core.job_queue import Job

router = APIRouter()
logger = logging.getLogger(__name__)


# ─── Image Generation ─────────────────────────────────────────────────────────

class ImageGenerationRequest(BaseModel):
    prompt: str
    negative_prompt: str = Field(default="")
    model_id: str
    width: int = Field(default=1024, ge=64, le=2048)
    height: int = Field(default=1024, ge=64, le=2048)
    steps: int = Field(default=20, ge=1, le=150)
    cfg_scale: float = Field(default=7.5, ge=1.0, le=30.0)
    seed: int = Field(default=-1)
    sampler: str = Field(default="DPM++ 2M Karras")
    batch_size: int = Field(default=1, ge=1, le=8)
    lora_weights: list[dict[str, Any]] = Field(default_factory=list)


@router.post("/image")
async def generate_image(body: ImageGenerationRequest, request: Request) -> dict:
    jq = request.app.state.job_queue
    gpu = request.app.state.gpu_scheduler
    mm = request.app.state.model_manager
    settings = request.app.state.settings

    model = await mm.get_model(body.model_id)
    if not model:
        raise HTTPException(status_code=404, detail=f"Model '{body.model_id}' not found")
    if not model.get("installed"):
        raise HTTPException(status_code=400, detail="Model is not installed. Install it first.")

    install_path = await mm.get_install_path(body.model_id)
    if not install_path:
        raise HTTPException(status_code=400, detail="Model install path not found")

    output_dir = settings.data_dir / "outputs" / "images"
    output_dir.mkdir(parents=True, exist_ok=True)

    params = body.model_dump()

    async def _run(job: Job) -> None:
        pipeline = ImageGenerationPipeline(
            model_path=install_path,
            device=gpu.device,
        )
        output_paths = await pipeline.generate(
            job=job,
            params=params,
            output_dir=output_dir,
        )
        job.output_files = [str(p) for p in output_paths]

    job = await jq.submit_with_coro(
        job_type="image-generation",
        coro_fn=_run,
        input_params=params,
        model_id=body.model_id,
    )

    return {"job_id": job.id}


# ─── Speech Recognition ───────────────────────────────────────────────────────

class TranscriptionRequest(BaseModel):
    audio_path: str
    language: Optional[str] = None
    model_id: Optional[str] = None


@router.post("/transcribe")
async def transcribe(body: TranscriptionRequest, request: Request) -> dict:
    jq = request.app.state.job_queue
    gpu = request.app.state.gpu_scheduler
    settings = request.app.state.settings

    params = body.model_dump()

    async def _run(job: Job) -> None:
        pipeline = SpeechRecognitionPipeline(
            model_size=settings.whisper_model_size,
            device=gpu.device,
            compute_type=settings.whisper_compute_type,
        )
        result = await pipeline.transcribe(
            job=job,
            audio_path=Path(body.audio_path),
            language=body.language,
        )
        job.result = result

    job = await jq.submit_with_coro(
        job_type="speech-recognition",
        coro_fn=_run,
        input_params=params,
    )

    return {"job_id": job.id}


# ─── TTS ──────────────────────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str
    voice_path: Optional[str] = None
    language: str = "en"
    speed: float = Field(default=1.0, ge=0.1, le=3.0)
    model_id: Optional[str] = None


@router.post("/tts")
async def text_to_speech(body: TTSRequest, request: Request) -> dict:
    jq = request.app.state.job_queue
    gpu = request.app.state.gpu_scheduler
    settings = request.app.state.settings

    output_dir = settings.data_dir / "outputs" / "audio"
    output_dir.mkdir(parents=True, exist_ok=True)

    params = body.model_dump()

    async def _run(job: Job) -> None:
        pipeline = TTSPipeline(device=gpu.device)
        output_path = await pipeline.synthesize(
            job=job,
            text=body.text,
            voice_path=Path(body.voice_path) if body.voice_path else None,
            language=body.language,
            speed=body.speed,
            output_dir=output_dir,
        )
        job.output_files = [str(output_path)]

    job = await jq.submit_with_coro(
        job_type="tts",
        coro_fn=_run,
        input_params=params,
    )

    return {"job_id": job.id}


# ─── Upscaling ────────────────────────────────────────────────────────────────

class UpscaleRequest(BaseModel):
    image_path: str
    scale: int = Field(default=4, ge=2, le=8)
    model_id: Optional[str] = None


@router.post("/upscale")
async def upscale_image(body: UpscaleRequest, request: Request) -> dict:
    jq = request.app.state.job_queue
    gpu = request.app.state.gpu_scheduler
    settings = request.app.state.settings

    output_dir = settings.data_dir / "outputs" / "upscaled"
    output_dir.mkdir(parents=True, exist_ok=True)

    params = body.model_dump()

    async def _run(job: Job) -> None:
        pipeline = UpscalingPipeline(device=gpu.device)
        output_path = await pipeline.upscale(
            job=job,
            image_path=Path(body.image_path),
            scale=body.scale,
            output_dir=output_dir,
        )
        job.output_files = [str(output_path)]

    job = await jq.submit_with_coro(
        job_type="upscaling",
        coro_fn=_run,
        input_params=params,
    )

    return {"job_id": job.id}


# ─── Background Removal ───────────────────────────────────────────────────────

class BackgroundRemovalRequest(BaseModel):
    image_path: str
    model: str = "u2net"


@router.post("/remove-bg")
async def remove_background(body: BackgroundRemovalRequest, request: Request) -> dict:
    jq = request.app.state.job_queue
    settings = request.app.state.settings

    output_dir = settings.data_dir / "outputs" / "no-bg"
    output_dir.mkdir(parents=True, exist_ok=True)

    params = body.model_dump()

    async def _run(job: Job) -> None:
        pipeline = BackgroundRemovalPipeline(model_name=body.model)
        output_path = await pipeline.remove_background(
            job=job,
            image_path=Path(body.image_path),
            output_dir=output_dir,
        )
        job.output_files = [str(output_path)]

    job = await jq.submit_with_coro(
        job_type="background-removal",
        coro_fn=_run,
        input_params=params,
    )

    return {"job_id": job.id}
