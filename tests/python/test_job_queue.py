"""
Python backend unit tests — Job Queue
"""
import asyncio
import pytest
from core.job_queue import Job, JobQueue, JobStatus


@pytest.mark.asyncio
async def test_submit_and_complete():
    jq = JobQueue(max_concurrent=1)
    await jq.start()

    completed = []

    async def _work(job: Job) -> None:
        job.progress = 0.5
        await asyncio.sleep(0.01)
        job.progress = 1.0
        completed.append(job.id)

    job = await jq.submit_with_coro("test", _work, {"x": 1})
    assert job.status == JobStatus.QUEUED

    # Wait for job to finish
    for _ in range(50):
        await asyncio.sleep(0.05)
        if job.status in (JobStatus.COMPLETED, JobStatus.FAILED):
            break

    assert job.status == JobStatus.COMPLETED
    assert job.id in completed

    await jq.stop()


@pytest.mark.asyncio
async def test_cancel_queued_job():
    jq = JobQueue(max_concurrent=1)
    await jq.start()

    # Block the worker with a slow job first
    slow_done = asyncio.Event()

    async def _slow(job: Job) -> None:
        await asyncio.sleep(5)
        slow_done.set()

    async def _fast(job: Job) -> None:
        pass

    slow_job = await jq.submit_with_coro("slow", _slow, {})
    fast_job = await jq.submit_with_coro("fast", _fast, {})

    # Cancel the queued fast job
    success = await jq.cancel(fast_job.id)
    assert success
    assert fast_job.status == JobStatus.CANCELLED

    # Cancel slow job too
    await jq.cancel(slow_job.id)
    await jq.stop()


@pytest.mark.asyncio
async def test_list_jobs():
    jq = JobQueue()

    async def _noop(job: Job) -> None:
        pass

    j1 = await jq.submit_with_coro("type-a", _noop, {})
    j2 = await jq.submit_with_coro("type-b", _noop, {})
    j3 = await jq.submit_with_coro("type-a", _noop, {})

    all_jobs = jq.list_jobs()
    assert len(all_jobs) == 3

    type_a = jq.list_jobs(job_type="type-a")
    assert len(type_a) == 2
