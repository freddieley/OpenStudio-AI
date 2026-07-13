use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::State;

use crate::state::AppState;

#[derive(Serialize, Deserialize, Debug)]
pub struct PluginRecord {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub entry_point: String,
    pub enabled: i64,
    pub installed: i64,
    pub install_path: Option<String>,
    pub manifest: Value,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub async fn list_plugins(state: State<'_, AppState>) -> Result<Vec<PluginRecord>, String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;

    let rows = db
        .query_many("SELECT * FROM plugins ORDER BY name ASC", &[])
        .map_err(|e| e.to_string())?;

    let plugins = rows
        .into_iter()
        .filter_map(|row| serde_json::from_value(row).ok())
        .collect();

    Ok(plugins)
}

#[tauri::command]
pub async fn enable_plugin(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;
    db.execute(
        "UPDATE plugins SET enabled = 1, updated_at = datetime('now') WHERE id = ?1",
        &[&id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn disable_plugin(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;
    db.execute(
        "UPDATE plugins SET enabled = 0, updated_at = datetime('now') WHERE id = ?1",
        &[&id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn install_plugin(
    source: String,
    state: State<'_, AppState>,
) -> Result<PluginRecord, String> {
    let backend_guard = state.python_backend.lock().await;
    let backend = backend_guard
        .as_ref()
        .ok_or("Python backend not available")?;

    let response = backend
        .request("POST", "/api/plugins/install", Some(json!({ "source": source })))
        .await
        .map_err(|e| e.to_string())?;

    serde_json::from_value(response).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn uninstall_plugin(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let backend_guard = state.python_backend.lock().await;
    let backend = backend_guard
        .as_ref()
        .ok_or("Python backend not available")?;

    backend
        .request("DELETE", &format!("/api/plugins/{}", id), None)
        .await
        .map_err(|e| e.to_string())?;

    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;
    db.execute("DELETE FROM plugins WHERE id = ?1", &[&id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_plugin_marketplace(state: State<'_, AppState>) -> Result<Vec<Value>, String> {
    let backend_guard = state.python_backend.lock().await;
    let backend = backend_guard
        .as_ref()
        .ok_or("Python backend not available")?;

    let response = backend
        .request("GET", "/api/plugins/marketplace", None)
        .await
        .map_err(|e| e.to_string())?;

    response
        .get("plugins")
        .and_then(|p| p.as_array())
        .cloned()
        .ok_or_else(|| "Invalid marketplace response".to_string())
}
