use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use crate::state::AppState;

#[derive(Serialize, Deserialize, Debug)]
pub struct JobRecord {
    pub id: String,
    pub r#type: String,
    pub status: String,
    pub priority: i64,
    pub progress: f64,
    pub result: Option<String>,
    pub error: Option<String>,
    pub input_params: Value,
    pub output_files: Value,
    pub model_id: Option<String>,
    pub project_id: Option<String>,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub duration_ms: Option<i64>,
}

#[tauri::command]
pub async fn list_jobs(
    status: Option<String>,
    job_type: Option<String>,
    limit: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<JobRecord>, String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;

    let mut sql = "SELECT * FROM jobs WHERE 1=1".to_string();
    if let Some(s) = &status {
        sql.push_str(&format!(" AND status = '{}'", s.replace('\'', "''")));
    }
    if let Some(t) = &job_type {
        sql.push_str(&format!(" AND type = '{}'", t.replace('\'', "''")));
    }
    sql.push_str(" ORDER BY created_at DESC");
    if let Some(l) = limit {
        sql.push_str(&format!(" LIMIT {}", l));
    }

    let rows = db.query_many(&sql, &[]).map_err(|e| e.to_string())?;
    let jobs = rows
        .into_iter()
        .filter_map(|row| serde_json::from_value(row).ok())
        .collect();

    Ok(jobs)
}

#[tauri::command]
pub async fn get_job(id: String, state: State<'_, AppState>) -> Result<JobRecord, String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;

    let row = db
        .query_one("SELECT * FROM jobs WHERE id = ?1", &[&id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Job '{}' not found", id))?;

    serde_json::from_value(row).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cancel_job(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let backend_guard = state.python_backend.lock();
    let backend = backend_guard
        .as_ref()
        .ok_or("Python backend not available")?;

    backend
        .request("POST", &format!("/api/jobs/{}/cancel", id), None)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn clear_completed_jobs(state: State<'_, AppState>) -> Result<usize, String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;

    db.execute(
        "DELETE FROM jobs WHERE status IN ('completed', 'failed', 'cancelled')",
        &[],
    )
    .map_err(|e| e.to_string())
}
