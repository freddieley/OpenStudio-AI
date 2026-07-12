"""
Python backend unit tests — Workflow Engine
"""
import asyncio
import pytest
from core.workflow_engine import WorkflowEngine


class _MockDB:
    pass


class _MockJobQueue:
    pass


class _MockGPU:
    device = "cpu"


class _MockModelManager:
    async def get_install_path(self, _: str):
        return None


class _FakeJob:
    progress = 0.0
    cancel_event = asyncio.Event()


def make_engine():
    return WorkflowEngine(
        db=_MockDB(),
        job_queue=_MockJobQueue(),
        gpu_scheduler=_MockGPU(),
        model_manager=_MockModelManager(),
    )


@pytest.mark.asyncio
async def test_text_passthrough():
    engine = make_engine()
    nodes = [
        {"id": "n1", "type": "workflowNode", "position": {"x": 0, "y": 0}, "data": {
            "metadata": {"id": "text-input"}, "params": {"text": "hello world"}, "inputs": [], "outputs": []
        }},
        {"id": "n2", "type": "workflowNode", "position": {"x": 200, "y": 0}, "data": {
            "metadata": {"id": "text-combine"}, "params": {"separator": " "}, "inputs": [], "outputs": []
        }},
    ]
    edges = [
        {"id": "e1", "source": "n1", "target": "n2", "sourceHandle": "text", "targetHandle": "text_a"},
    ]

    job = _FakeJob()
    outputs = await engine.execute(job, nodes, edges, {})
    assert "n1" in outputs
    assert outputs["n1"]["text"] == "hello world"


@pytest.mark.asyncio
async def test_cycle_detection():
    engine = make_engine()
    nodes = [
        {"id": "a", "data": {"metadata": {"id": "text-input"}, "params": {}, "inputs": [], "outputs": []}},
        {"id": "b", "data": {"metadata": {"id": "text-input"}, "params": {}, "inputs": [], "outputs": []}},
    ]
    # Cycle: a → b → a
    edges = [
        {"id": "e1", "source": "a", "target": "b", "sourceHandle": "text", "targetHandle": "text"},
        {"id": "e2", "source": "b", "target": "a", "sourceHandle": "text", "targetHandle": "text"},
    ]

    job = _FakeJob()
    with pytest.raises(ValueError, match="cycle"):
        await engine.execute(job, nodes, edges, {})
