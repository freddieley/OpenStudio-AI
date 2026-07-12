from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator

import aiosqlite

logger = logging.getLogger(__name__)


class Database:
    """Async SQLite database wrapper with connection pooling."""

    def __init__(self, db_path: Path) -> None:
        self._path = db_path
        self._conn: aiosqlite.Connection | None = None

    async def connect(self) -> None:
        self._conn = await aiosqlite.connect(self._path)
        self._conn.row_factory = aiosqlite.Row
        await self._conn.execute("PRAGMA journal_mode = WAL")
        await self._conn.execute("PRAGMA synchronous = NORMAL")
        await self._conn.execute("PRAGMA foreign_keys = ON")
        await self._conn.execute("PRAGMA temp_store = MEMORY")
        await self._conn.commit()
        logger.info("Database connected: %s", self._path)
        await self._run_migrations()

    async def close(self) -> None:
        if self._conn:
            await self._conn.close()
            self._conn = None

    @property
    def conn(self) -> aiosqlite.Connection:
        assert self._conn is not None, "Database not connected"
        return self._conn

    async def execute(self, sql: str, params: tuple[Any, ...] = ()) -> int:
        async with self.conn.execute(sql, params) as cursor:
            await self.conn.commit()
            return cursor.rowcount

    async def fetchone(self, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        async with self.conn.execute(sql, params) as cursor:
            row = await cursor.fetchone()
            if row is None:
                return None
            return dict(row)

    async def fetchall(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        async with self.conn.execute(sql, params) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    @asynccontextmanager
    async def transaction(self) -> AsyncGenerator[None, None]:
        async with self.conn:
            yield

    async def _run_migrations(self) -> None:
        await self.conn.execute(
            """CREATE TABLE IF NOT EXISTS schema_migrations (
                version    INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            )"""
        )
        await self.conn.commit()

        async with self.conn.execute(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations"
        ) as cur:
            row = await cur.fetchone()
            current_version = row[0] if row else 0

        migrations = [
            (1, MIGRATION_001_WORKFLOWS),
            (2, MIGRATION_002_MODELS_REGISTRY),
        ]

        for version, sql in migrations:
            if version > current_version:
                await self.conn.executescript(sql)
                await self.conn.execute(
                    "INSERT INTO schema_migrations (version) VALUES (?)", (version,)
                )
                await self.conn.commit()
                logger.info("Applied migration v%d", version)


# ─── Schema migrations ────────────────────────────────────────────────────────

MIGRATION_001_WORKFLOWS = """
CREATE TABLE IF NOT EXISTS workflows (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    version     TEXT NOT NULL DEFAULT '1.0.0',
    nodes       TEXT NOT NULL DEFAULT '[]',
    edges       TEXT NOT NULL DEFAULT '[]',
    viewport    TEXT NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}',
    project_id  TEXT,
    tags        TEXT NOT NULL DEFAULT '[]',
    metadata    TEXT NOT NULL DEFAULT '{}',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workflows_project ON workflows(project_id);
"""

MIGRATION_002_MODELS_REGISTRY = """
CREATE TABLE IF NOT EXISTS model_registry (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL,
    variant         TEXT NOT NULL DEFAULT 'base',
    description     TEXT NOT NULL DEFAULT '',
    author          TEXT NOT NULL DEFAULT '',
    license         TEXT NOT NULL DEFAULT '',
    version         TEXT NOT NULL DEFAULT '1.0.0',
    size_bytes      INTEGER NOT NULL DEFAULT 0,
    vram_mb         INTEGER NOT NULL DEFAULT 0,
    installed       INTEGER NOT NULL DEFAULT 0,
    install_path    TEXT,
    download_url    TEXT,
    sha256          TEXT,
    thumbnail       TEXT,
    tags            TEXT NOT NULL DEFAULT '[]',
    metadata        TEXT NOT NULL DEFAULT '{}',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
"""
