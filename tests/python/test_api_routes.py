"""
Integration tests for the FastAPI routes.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from pathlib import Path
import tempfile

from core.config import Settings


@pytest.fixture
def settings(tmp_path):
    s = Settings()
    s.data_dir = tmp_path
    s.gpu_enabled = False
    s.dev_mode = True
    return s


@pytest.fixture
def app(settings):
    from api.app import create_app
    return create_app(settings)


@pytest_asyncio.fixture
async def client(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data


@pytest.mark.asyncio
async def test_list_models(client):
    resp = await client.get("/api/models")
    assert resp.status_code == 200
    data = resp.json()
    assert "models" in data
    assert isinstance(data["models"], list)
    # Should have seeded built-in models
    assert data["total"] > 0


@pytest.mark.asyncio
async def test_get_model_not_found(client):
    resp = await client.get("/api/models/nonexistent-id")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_jobs_empty(client):
    resp = await client.get("/api/jobs")
    assert resp.status_code == 200
    data = resp.json()
    assert data["jobs"] == []


@pytest.mark.asyncio
async def test_workflow_crud(client):
    # Create
    wf = {
        "name": "Test Workflow",
        "description": "A test workflow",
        "nodes": [],
        "edges": [],
    }
    resp = await client.post("/api/workflows", json=wf)
    assert resp.status_code == 200
    created = resp.json()
    wf_id = created["id"]

    # Get
    resp = await client.get(f"/api/workflows/{wf_id}")
    assert resp.status_code == 200

    # List
    resp = await client.get("/api/workflows")
    assert resp.status_code == 200
    assert any(w["id"] == wf_id for w in resp.json()["workflows"])

    # Delete
    resp = await client.delete(f"/api/workflows/{wf_id}")
    assert resp.status_code == 200

    # Confirm deleted
    resp = await client.get(f"/api/workflows/{wf_id}")
    assert resp.status_code == 404
