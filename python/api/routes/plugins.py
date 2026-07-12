from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


@router.get("")
async def list_plugins(request: Request) -> dict:
    # Plugins are managed by the Rust/Tauri layer; this endpoint mirrors back
    # plugin metadata from the shared database.
    db = request.app.state.db
    rows = await db.fetchall("SELECT * FROM plugins ORDER BY name")
    return {"plugins": rows, "total": len(rows)}


@router.post("/install")
async def install_plugin(request: Request) -> dict:
    body = await request.json()
    source: str = body.get("source", "")
    # Plugin installation logic (filesystem scan, validation, registration)
    raise HTTPException(status_code=501, detail="Plugin installation via API coming soon")


@router.delete("/{plugin_id}")
async def uninstall_plugin(plugin_id: str, request: Request) -> dict:
    db = request.app.state.db
    await db.execute("DELETE FROM plugins WHERE id = ?", (plugin_id,))
    return {"success": True}


@router.get("/marketplace")
async def get_marketplace(request: Request) -> dict:
    # Returns curated community plugins from a local manifest
    # In production this would also fetch from a remote registry
    return {"plugins": [], "total": 0}
