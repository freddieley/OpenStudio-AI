import json
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


class SaveWorkflowRequest(BaseModel):
    id: Optional[str] = None
    name: str
    description: str = ""
    version: str = "1.0.0"
    nodes: list = []
    edges: list = []
    viewport: dict = {"x": 0, "y": 0, "zoom": 1}
    project_id: Optional[str] = None
    tags: list = []
    metadata: dict = {}


@router.get("")
async def list_workflows(request: Request, project_id: Optional[str] = None) -> dict:
    db = request.app.state.db
    if project_id:
        rows = await db.fetchall(
            "SELECT * FROM workflows WHERE project_id = ? ORDER BY updated_at DESC", (project_id,)
        )
    else:
        rows = await db.fetchall("SELECT * FROM workflows ORDER BY updated_at DESC")
    return {"workflows": rows, "total": len(rows)}


@router.get("/{workflow_id}")
async def get_workflow(workflow_id: str, request: Request) -> dict:
    db = request.app.state.db
    row = await db.fetchone("SELECT * FROM workflows WHERE id = ?", (workflow_id,))
    if not row:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found")
    # Deserialize JSON fields
    for field in ("nodes", "edges", "viewport", "tags", "metadata"):
        if isinstance(row.get(field), str):
            row[field] = json.loads(row[field])
    return row


@router.post("")
async def save_workflow(body: SaveWorkflowRequest, request: Request) -> dict:
    db = request.app.state.db
    wf_id = body.id or str(uuid.uuid4())

    await db.execute(
        """INSERT OR REPLACE INTO workflows
           (id, name, description, version, nodes, edges, viewport, project_id, tags, metadata, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
        (
            wf_id,
            body.name,
            body.description,
            body.version,
            json.dumps(body.nodes),
            json.dumps(body.edges),
            json.dumps(body.viewport),
            body.project_id,
            json.dumps(body.tags),
            json.dumps(body.metadata),
        ),
    )
    return await get_workflow(wf_id, request)


@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str, request: Request) -> dict:
    db = request.app.state.db
    await db.execute("DELETE FROM workflows WHERE id = ?", (workflow_id,))
    return {"success": True}


@router.post("/execute")
async def execute_workflow(request: Request) -> dict:
    body = await request.json()
    workflow_id = body.get("workflow_id")
    params = body.get("params", {})

    db = request.app.state.db
    jq = request.app.state.job_queue

    row = await db.fetchone("SELECT * FROM workflows WHERE id = ?", (workflow_id,))
    if not row:
        raise HTTPException(status_code=404, detail=f"Workflow '{workflow_id}' not found")

    from core.job_queue import Job

    async def _run(job: Job) -> None:
        # The workflow engine executes nodes in topological order
        # For now, mark as completed (full engine implemented in workflow_engine.py)
        from core.workflow_engine import WorkflowEngine
        engine = WorkflowEngine(
            db=request.app.state.db,
            job_queue=request.app.state.job_queue,
            gpu_scheduler=request.app.state.gpu_scheduler,
            model_manager=request.app.state.model_manager,
        )
        nodes = json.loads(row["nodes"]) if isinstance(row["nodes"], str) else row["nodes"]
        edges = json.loads(row["edges"]) if isinstance(row["edges"], str) else row["edges"]
        await engine.execute(job=job, nodes=nodes, edges=edges, params=params)

    job = await jq.submit_with_coro(
        job_type="workflow-execution",
        coro_fn=_run,
        input_params={"workflow_id": workflow_id, "params": params},
    )
    return {"job_id": job.id}
