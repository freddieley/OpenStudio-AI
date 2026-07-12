from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "version": "0.1.0"}


@router.post("/shutdown")
async def shutdown() -> dict:
    """Signal graceful shutdown (handled by the server)."""
    import os, signal
    os.kill(os.getpid(), signal.SIGTERM)
    return {"status": "shutting_down"}
