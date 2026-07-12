use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::State;

use crate::state::AppState;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModelRecord {
    pub id: String,
    pub name: String,
    pub r#type: String,
    pub variant: String,
    pub description: String,
    pub author: String,
    pub license: String,
    pub version: String,
    pub size_bytes: i64,
    pub vram_mb: i64,
    pub installed: i64,
    pub install_path: Option<String>,
    pub download_url: Option<String>,
    pub sha256: Option<String>,
    pub thumbnail: Option<String>,
    pub tags: Value,
    pub metadata: Value,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct InstallModelInput {
    pub id: String,
    pub install_path: Option<String>,
}

#[tauri::command]
pub async fn list_models(
    model_type: Option<String>,
    installed_only: Option<bool>,
    state: State<'_, AppState>,
) -> Result<Vec<ModelRecord>, String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;

    let mut sql = "SELECT * FROM models WHERE 1=1".to_string();
    if let Some(t) = &model_type {
        sql.push_str(&format!(" AND type = '{}'", t.replace('\'', "''")));
    }
    if installed_only == Some(true) {
        sql.push_str(" AND installed = 1");
    }
    sql.push_str(" ORDER BY name ASC");

    let rows = db.query_many(&sql, &[]).map_err(|e| e.to_string())?;
    let models = rows
        .into_iter()
        .filter_map(|row| serde_json::from_value(row).ok())
        .collect();

    Ok(models)
}

#[tauri::command]
pub async fn get_model(id: String, state: State<'_, AppState>) -> Result<ModelRecord, String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;

    let row = db
        .query_one("SELECT * FROM models WHERE id = ?1", &[&id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Model '{}' not found", id))?;

    serde_json::from_value(row).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn install_model(
    input: InstallModelInput,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Delegate the actual download/installation to the Python backend
    let backend_guard = state.python_backend.lock();
    let backend = backend_guard
        .as_ref()
        .ok_or("Python backend not available")?;

    let response = backend
        .request(
            "POST",
            "/api/models/install",
            Some(json!({
                "model_id": input.id,
                "install_path": input.install_path,
            })),
        )
        .await
        .map_err(|e| e.to_string())?;

    let job_id = response
        .get("job_id")
        .and_then(|v| v.as_str())
        .ok_or("Backend did not return a job_id")?
        .to_string();

    Ok(job_id)
}

#[tauri::command]
pub async fn uninstall_model(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let backend_guard = state.python_backend.lock();
    let backend = backend_guard
        .as_ref()
        .ok_or("Python backend not available")?;

    backend
        .request("DELETE", &format!("/api/models/{}", id), None)
        .await
        .map_err(|e| e.to_string())?;

    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;
    db.execute(
        "UPDATE models SET installed = 0, install_path = NULL WHERE id = ?1",
        &[&id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_model_install_progress(
    job_id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let backend_guard = state.python_backend.lock();
    let backend = backend_guard
        .as_ref()
        .ok_or("Python backend not available")?;

    backend
        .request("GET", &format!("/api/jobs/{}", job_id), None)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cancel_model_install(
    job_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let backend_guard = state.python_backend.lock();
    let backend = backend_guard
        .as_ref()
        .ok_or("Python backend not available")?;

    backend
        .request("POST", &format!("/api/jobs/{}/cancel", job_id), None)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn refresh_model_registry(state: State<'_, AppState>) -> Result<Vec<Value>, String> {
    let backend_guard = state.python_backend.lock();
    let backend = backend_guard
        .as_ref()
        .ok_or("Python backend not available")?;

    backend
        .request("GET", "/api/models/registry/refresh", None)
        .await
        .map_err(|e| e.to_string())?;

    // Re-query the DB after refresh
    drop(backend_guard);
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;
    db.query_many("SELECT * FROM models ORDER BY name", &[])
        .map_err(|e| e.to_string())
}
