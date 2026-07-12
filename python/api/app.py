"""
FastAPI application factory for OpenStudio AI backend.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import Settings
from core.database import Database
from core.gpu_scheduler import GPUScheduler
from core.job_queue import JobQueue
from core.model_manager import ModelManager

logger = logging.getLogger(__name__)


def create_app(settings: Settings) -> FastAPI:
    """Create and configure the FastAPI application."""
    db = Database(settings.db_path)
    job_queue = JobQueue(max_concurrent=1)
    gpu_scheduler = GPUScheduler(
        vram_budget_mb=settings.gpu_vram_budget_mb,
        device=settings.gpu_device if settings.gpu_enabled else "cpu",
    )
    model_manager = ModelManager(settings, db, job_queue)

    @asynccontextmanager
    async def lifespan(app: FastAPI):  # type: ignore[type-arg]
        # Startup
        settings.ensure_dirs()
        await db.connect()
        await job_queue.start()
        job_queue.set_db(db)
        await model_manager.initialize()
        logger.info("OpenStudio AI backend ready on port %d", settings.backend_port)
        yield
        # Shutdown
        await gpu_scheduler.evict_all()
        await job_queue.stop()
        await db.close()
        logger.info("Backend shutdown complete")

    app = FastAPI(
        title="OpenStudio AI Backend",
        version="0.1.0",
        description="Local AI backend for OpenStudio AI",
        lifespan=lifespan,
        docs_url="/docs" if settings.dev_mode else None,
        redoc_url=None,
    )

    # CORS — only allow localhost (Tauri frontend)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",  # Vite dev
            "tauri://localhost",
            "https://tauri.localhost",
        ],
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
    )

    # Store shared state on app
    app.state.settings = settings
    app.state.db = db
    app.state.job_queue = job_queue
    app.state.gpu_scheduler = gpu_scheduler
    app.state.model_manager = model_manager

    # Register routers
    from api.routes import (
        health,
        system,
        models,
        jobs,
        generate,
        workflows,
        plugins,
    )

    app.include_router(health.router, tags=["health"])
    app.include_router(system.router, prefix="/api/system", tags=["system"])
    app.include_router(models.router, prefix="/api/models", tags=["models"])
    app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
    app.include_router(generate.router, prefix="/api/generate", tags=["generate"])
    app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])
    app.include_router(plugins.router, prefix="/api/plugins", tags=["plugins"])

    # Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception in %s %s: %s", request.method, request.url, exc)
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc), "type": type(exc).__name__},
        )

    return app
