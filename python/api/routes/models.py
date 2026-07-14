import json
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


def _deserialize_row(row: dict[str, Any]) -> dict[str, Any]:
    """Parse JSON-string columns (tags, metadata) into proper objects."""
    for field in ("tags", "metadata"):
        val = row.get(field)
        if isinstance(val, str):
            try:
                row[field] = json.loads(val)
            except (json.JSONDecodeError, TypeError):
                row[field] = [] if field == "tags" else {}
    return row


class InstallModelRequest(BaseModel):
    model_id: str
    install_path: Optional[str] = None


@router.get("")
async def list_models(
    request: Request,
    model_type: Optional[str] = None,
    installed_only: bool = False,
) -> dict:
    mm = request.app.state.model_manager
    models = await mm.list_models(model_type=model_type, installed_only=installed_only)
    return {"models": [_deserialize_row(m) for m in models], "total": len(models)}


@router.get("/{model_id}")
async def get_model(model_id: str, request: Request) -> dict:
    mm = request.app.state.model_manager
    model = await mm.get_model(model_id)
    if not model:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    return _deserialize_row(model)


@router.post("/install")
async def install_model(body: InstallModelRequest, request: Request) -> dict:
    mm = request.app.state.model_manager
    try:
        job = await mm.install_model(body.model_id, body.install_path)
        return {"job_id": job.id, "model_id": body.model_id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{model_id}")
async def uninstall_model(model_id: str, request: Request) -> dict:
    mm = request.app.state.model_manager
    try:
        await mm.uninstall_model(model_id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/registry/refresh")
async def refresh_registry(request: Request) -> dict:
    mm = request.app.state.model_manager
    await mm.initialize()
    models = await mm.list_models()
    return {"models": models, "total": len(models)}
