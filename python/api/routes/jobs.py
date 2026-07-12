from typing import Optional
from fastapi import APIRouter, HTTPException, Request

router = APIRouter()


@router.get("")
async def list_jobs(
    request: Request,
    status: Optional[str] = None,
    job_type: Optional[str] = None,
    limit: int = 100,
) -> dict:
    jq = request.app.state.job_queue
    jobs = jq.list_jobs(status=status, job_type=job_type, limit=limit)
    return {"jobs": [j.to_dict() for j in jobs], "total": len(jobs)}


@router.get("/{job_id}")
async def get_job(job_id: str, request: Request) -> dict:
    jq = request.app.state.job_queue
    job = jq.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return job.to_dict()


@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str, request: Request) -> dict:
    jq = request.app.state.job_queue
    success = await jq.cancel(job_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found or already finished")
    return {"success": True, "job_id": job_id}
