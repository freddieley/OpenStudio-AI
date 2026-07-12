use anyhow::{Context, Result};
use rusqlite::{Connection, params};
use serde_json::Value;
use std::path::Path;
use tracing::info;

/// SQLite database wrapper with connection pooling via a single Mutex.
pub struct Database {
    conn: Connection,
}

impl Database {
    /// Open (or create) the application database at the given path.
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let conn = Connection::open(path.as_ref())
            .with_context(|| format!("Failed to open database at {:?}", path.as_ref()))?;

        // Performance pragmas
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA foreign_keys = ON;
             PRAGMA temp_store = MEMORY;
             PRAGMA mmap_size = 134217728;",
        )?;

        let db = Self { conn };
        db.run_migrations()?;
        info!("Database opened and migrations applied");
        Ok(db)
    }

    /// Execute all pending schema migrations.
    fn run_migrations(&self) -> Result<()> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                version    INTEGER PRIMARY KEY,
                applied_at TEXT    NOT NULL DEFAULT (datetime('now'))
            );",
        )?;

        let applied: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |row| row.get(0),
        )?;

        let migrations: &[(&str, i64)] = &[
            (MIGRATION_001_CORE, 1),
            (MIGRATION_002_MODELS, 2),
            (MIGRATION_003_JOBS, 3),
            (MIGRATION_004_PLUGINS, 4),
            (MIGRATION_005_ASSETS, 5),
        ];

        for (sql, version) in migrations {
            if *version > applied {
                self.conn.execute_batch(sql)?;
                self.conn.execute(
                    "INSERT INTO schema_migrations (version) VALUES (?1)",
                    params![version],
                )?;
                info!("Applied migration v{}", version);
            }
        }

        Ok(())
    }

    /// Execute a raw SQL statement (no return value).
    pub fn execute(&self, sql: &str, params: &[&dyn rusqlite::types::ToSql]) -> Result<usize> {
        Ok(self.conn.execute(sql, params)?)
    }

    /// Query a single row and deserialize it as JSON.
    pub fn query_one(&self, sql: &str, params: &[&dyn rusqlite::types::ToSql]) -> Result<Option<Value>> {
        let mut stmt = self.conn.prepare(sql)?;
        let cols: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

        let result = stmt.query_row(params, |row| {
            let mut map = serde_json::Map::new();
            for (i, name) in cols.iter().enumerate() {
                let val: rusqlite::types::Value = row.get(i)?;
                map.insert(name.clone(), sqlite_value_to_json(val));
            }
            Ok(serde_json::Value::Object(map))
        });

        match result {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Query multiple rows and return them as a JSON array.
    pub fn query_many(&self, sql: &str, params: &[&dyn rusqlite::types::ToSql]) -> Result<Vec<Value>> {
        let mut stmt = self.conn.prepare(sql)?;
        let cols: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

        let rows = stmt.query_map(params, |row| {
            let mut map = serde_json::Map::new();
            for (i, name) in cols.iter().enumerate() {
                let val: rusqlite::types::Value = row.get(i)?;
                map.insert(name.clone(), sqlite_value_to_json(val));
            }
            Ok(serde_json::Value::Object(map))
        })?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    }

    /// Begin a transaction, execute closure, commit on success, rollback on failure.
    pub fn transaction<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&Connection) -> Result<T>,
    {
        let tx = self.conn.unchecked_transaction()?;
        match f(&self.conn) {
            Ok(v) => {
                tx.commit()?;
                Ok(v)
            }
            Err(e) => {
                let _ = tx.rollback();
                Err(e)
            }
        }
    }
}

fn sqlite_value_to_json(val: rusqlite::types::Value) -> serde_json::Value {
    match val {
        rusqlite::types::Value::Null => serde_json::Value::Null,
        rusqlite::types::Value::Integer(i) => serde_json::Value::Number(i.into()),
        rusqlite::types::Value::Real(f) => {
            serde_json::Number::from_f64(f)
                .map(serde_json::Value::Number)
                .unwrap_or(serde_json::Value::Null)
        }
        rusqlite::types::Value::Text(s) => serde_json::Value::String(s),
        rusqlite::types::Value::Blob(b) => {
            serde_json::Value::String(hex::encode(b))
        }
    }
}

// ─── Schema migrations ────────────────────────────────────────────────────────

const MIGRATION_001_CORE: &str = "
CREATE TABLE IF NOT EXISTS projects (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    path        TEXT    NOT NULL,
    thumbnail   TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    metadata    TEXT    NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS settings (
    key         TEXT    PRIMARY KEY,
    value       TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO settings (key, value) VALUES
    ('theme', '\"dark\"'),
    ('language', '\"en\"'),
    ('python_path', '\"python\"'),
    ('backend_port', '8765'),
    ('gpu_enabled', 'true'),
    ('gpu_vram_budget_mb', '8192'),
    ('default_image_width', '1024'),
    ('default_image_height', '1024'),
    ('output_directory', '\"\"'),
    ('auto_save_interval_sec', '300'),
    ('telemetry_enabled', 'false'),
    ('first_run', 'true');
";

const MIGRATION_002_MODELS: &str = "
CREATE TABLE IF NOT EXISTS models (
    id              TEXT    PRIMARY KEY,
    name            TEXT    NOT NULL,
    type            TEXT    NOT NULL,
    variant         TEXT    NOT NULL DEFAULT 'base',
    description     TEXT    NOT NULL DEFAULT '',
    author          TEXT    NOT NULL DEFAULT '',
    license         TEXT    NOT NULL DEFAULT '',
    version         TEXT    NOT NULL DEFAULT '1.0.0',
    size_bytes      INTEGER NOT NULL DEFAULT 0,
    vram_mb         INTEGER NOT NULL DEFAULT 0,
    installed       INTEGER NOT NULL DEFAULT 0,
    install_path    TEXT,
    download_url    TEXT,
    sha256          TEXT,
    thumbnail       TEXT,
    tags            TEXT    NOT NULL DEFAULT '[]',
    metadata        TEXT    NOT NULL DEFAULT '{}',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_models_type ON models(type);
CREATE INDEX IF NOT EXISTS idx_models_installed ON models(installed);
";

const MIGRATION_003_JOBS: &str = "
CREATE TABLE IF NOT EXISTS jobs (
    id              TEXT    PRIMARY KEY,
    type            TEXT    NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'queued',
    priority        INTEGER NOT NULL DEFAULT 0,
    progress        REAL    NOT NULL DEFAULT 0.0,
    result          TEXT,
    error           TEXT,
    input_params    TEXT    NOT NULL DEFAULT '{}',
    output_files    TEXT    NOT NULL DEFAULT '[]',
    model_id        TEXT,
    project_id      TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    started_at      TEXT,
    completed_at    TEXT,
    duration_ms     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_project ON jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);
";

const MIGRATION_004_PLUGINS: &str = "
CREATE TABLE IF NOT EXISTS plugins (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    version     TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    author      TEXT    NOT NULL DEFAULT '',
    entry_point TEXT    NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 1,
    installed   INTEGER NOT NULL DEFAULT 0,
    install_path TEXT,
    manifest    TEXT    NOT NULL DEFAULT '{}',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
";

const MIGRATION_005_ASSETS: &str = "
CREATE TABLE IF NOT EXISTS assets (
    id              TEXT    PRIMARY KEY,
    name            TEXT    NOT NULL,
    type            TEXT    NOT NULL,
    mime_type       TEXT    NOT NULL DEFAULT '',
    path            TEXT    NOT NULL,
    thumbnail_path  TEXT,
    size_bytes      INTEGER NOT NULL DEFAULT 0,
    width           INTEGER,
    height          INTEGER,
    duration_sec    REAL,
    project_id      TEXT,
    tags            TEXT    NOT NULL DEFAULT '[]',
    metadata        TEXT    NOT NULL DEFAULT '{}',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
";
