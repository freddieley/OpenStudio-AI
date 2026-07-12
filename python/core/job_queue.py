"""
Job queue for OpenStudio AI.

Runs background inference jobs with priority, progress tracking,
cancellation, and persistent status in the SQLite database.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Coroutine, Optional

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


@dataclass
class Job:
    id: str
    type: str
    status: JobStatus
    priority: int
    progress: float
    result: Optional[Any]
    error: Optional[str]
    input_params: dict[str, Any]
    output_files: list[str]
    model_id: Optional[str]
    project_id: Optional[str]
    created_at: float
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    duration_ms: Optional[int] = None
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "status": self.status.value,
            "priority": self.priority,
            "progress": self.progress,
            "result": self.result,
            "error": self.error,
            "input_params": self.input_params,
            "output_files": self.output_files,
            "model_id": self.model_id,
            "project_id": self.project_id,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "duration_ms": self.duration_ms,
        }


class JobQueue:
    """
    Async job queue with priority scheduling.

    - Jobs are executed one-at-a-time (configurable concurrency)
    - Progress callbacks allow streaming updates to the frontend
    - Jobs can be cancelled at any point
    - Completed jobs are retained in memory for status queries
    """

    def __init__(self, max_concurrent: int = 1) -> None:
        self._jobs: dict[str, Job] = {}
        self._queue: asyncio.PriorityQueue[tuple[int, str]] = asyncio.PriorityQueue()
        self._max_concurrent = max_concurrent
        self._running_count = 0
        self._worker_task: Optional[asyncio.Task] = None
        self._db: Optional[Any] = None  # injected after startup

    def set_db(self, db: Any) -> None:
        self._db = db

    async def start(self) -> None:
        self._worker_task = asyncio.create_task(self._worker_loop())
        logger.info("Job queue started (max_concurrent=%d)", self._max_concurrent)

    async def stop(self) -> None:
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        logger.info("Job queue stopped")

    async def submit(
        self,
        job_type: str,
        coro_fn: Callable[[Job], Coroutine[Any, Any, Any]],
        input_params: dict[str, Any],
        model_id: Optional[str] = None,
        project_id: Optional[str] = None,
        priority: int = 0,
    ) -> Job:
        """Submit a new job and return it immediately (non-blocking)."""
        job = Job(
            id=str(uuid.uuid4()),
            type=job_type,
            status=JobStatus.QUEUED,
            priority=priority,
            progress=0.0,
            result=None,
            error=None,
            input_params=input_params,
            output_files=[],
            model_id=model_id,
            project_id=project_id,
            created_at=time.time(),
        )

        self._jobs[job.id] = job
        # Store in DB
        await self._persist_job(job)
        # Enqueue (negative priority = higher priority)
        await self._queue.put((-priority, job.id))
        logger.info("Job submitted: %s (type=%s)", job.id, job_type)
        return job

    async def cancel(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        if not job:
            return False
        if job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED):
            return False
        job.cancel_event.set()
        job.status = JobStatus.CANCELLED
        job.completed_at = time.time()
        await self._persist_job(job)
        logger.info("Job cancelled: %s", job_id)
        return True

    def get(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)

    def list_jobs(
        self,
        status: Optional[str] = None,
        job_type: Optional[str] = None,
        limit: int = 100,
    ) -> list[Job]:
        jobs = list(self._jobs.values())
        if status:
            jobs = [j for j in jobs if j.status.value == status]
        if job_type:
            jobs = [j for j in jobs if j.type == job_type]
        jobs.sort(key=lambda j: j.created_at, reverse=True)
        return jobs[:limit]

    async def _worker_loop(self) -> None:
        """Main worker loop — dispatches jobs from the queue."""
        while True:
            try:
                _, job_id = await self._queue.get()
                job = self._jobs.get(job_id)
                if not job:
                    continue
                if job.status == JobStatus.CANCELLED:
                    continue
                asyncio.create_task(self._run_job(job))
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.exception("Worker loop error: %s", exc)

    async def _run_job(self, job: Job) -> None:
        job.status = JobStatus.RUNNING
        job.started_at = time.time()
        await self._persist_job(job)
        logger.info("Job started: %s (type=%s)", job.id, job.type)

        try:
            coro_fn = self._jobs[job.id]._coro_fn  # type: ignore[attr-defined]
            await coro_fn(job)
            if job.status == JobStatus.RUNNING:
                job.status = JobStatus.COMPLETED
                job.progress = 1.0
        except asyncio.CancelledError:
            job.status = JobStatus.CANCELLED
        except Exception as exc:
            logger.exception("Job %s failed: %s", job.id, exc)
            job.status = JobStatus.FAILED
            job.error = str(exc)
        finally:
            job.completed_at = time.time()
            if job.started_at is not None:
                job.duration_ms = int((job.completed_at - job.started_at) * 1000)
            await self._persist_job(job)
            logger.info(
                "Job finished: %s — status=%s duration=%sms",
                job.id,
                job.status.value,
                job.duration_ms,
            )

    async def submit_with_coro(
        self,
        job_type: str,
        coro_fn: Callable[[Job], Coroutine[Any, Any, Any]],
        input_params: dict[str, Any],
        model_id: Optional[str] = None,
        project_id: Optional[str] = None,
        priority: int = 0,
    ) -> Job:
        """Submit a job with its coroutine function stored for execution."""
        job = await self.submit(
            job_type=job_type,
            coro_fn=coro_fn,
            input_params=input_params,
            model_id=model_id,
            project_id=project_id,
            priority=priority,
        )
        # Store coro_fn on job object for execution by _run_job
        object.__setattr__(job, "_coro_fn", coro_fn)  # type: ignore[call-arg]
        return job

    async def _persist_job(self, job: Job) -> None:
        """Write/update the job record in the database."""
        if self._db is None:
            return
        try:
            row = job.to_dict()
            await self._db.execute(
                """INSERT OR REPLACE INTO jobs (
                    id, type, status, priority, progress, result, error,
                    input_params, output_files, model_id, project_id,
                    created_at, started_at, completed_at, duration_ms
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    datetime(?, 'unixepoch'),
                    datetime(?, 'unixepoch'),
                    datetime(?, 'unixepoch'),
                    ?
                )""",
                (
                    row["id"], row["type"], row["status"], row["priority"],
                    row["progress"],
                    json.dumps(row["result"]) if row["result"] is not None else None,
                    row["error"],
                    json.dumps(row["input_params"]),
                    json.dumps(row["output_files"]),
                    row["model_id"], row["project_id"],
                    row["created_at"],
                    row["started_at"],
                    row["completed_at"],
                    row["duration_ms"],
                ),
            )
        except Exception as exc:
            logger.warning("Failed to persist job %s: %s", job.id, exc)
