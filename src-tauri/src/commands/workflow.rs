use serde_json::{json, Value};
use tauri::State;

use crate::state::AppState;

#[tauri::command]
pub async fn list_workflows(
    project_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<Value>, String> {
    let backend_guard = state.python_backend.lock().await;
    let backend = backend_guard
        .as_ref()
        .ok_or("Python backend not available")?;

    let path = if let Some(pid) = project_id {
        format!("/api/workflows?project_id={}", pid)
    } else {
        "/api/workflows".to_string()
    };

    let response = backend
        .request("GET", &path, None)
        .await
        .map_err(|e| e.to_string())?;

    response
        .get("workflows")
        .and_then(|w| w.as_array())
        .cloned()
        .ok_or_else(|| "Invalid workflows response".to_string())
}

#[tauri::command]
pub async fn save_workflow(
    workflow: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let backend_guard = state.python_backend.lock().await;
    let backend = backend_guard
        .as_ref()
        .ok_or("Python backend not available")?;

    backend
        .request("POST", "/api/workflows", Some(workflow))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_workflow(id: String, state: State<'_, AppState>) -> Result<Value, String> {
    let backend_guard = state.python_backend.lock().await;
    let backend = backend_guard
        .as_ref()
        .ok_or("Python backend not available")?;

    backend
        .request("GET", &format!("/api/workflows/{}", id), None)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_workflow(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let backend_guard = state.python_backend.lock().await;
    let backend = backend_guard
        .as_ref()
        .ok_or("Python backend not available")?;

    backend
        .request("DELETE", &format!("/api/workflows/{}", id), None)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn execute_workflow(
    workflow_id: String,
    params: Option<Value>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let backend_guard = state.python_backend.lock().await;
    let backend = backend_guard
        .as_ref()
        .ok_or("Python backend not available")?;

    let body = json!({
        "workflow_id": workflow_id,
        "params": params.unwrap_or(Value::Null),
    });

    let response = backend
        .request("POST", "/api/workflows/execute", Some(body))
        .await
        .map_err(|e| e.to_string())?;

    response
        .get("job_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Backend did not return a job_id".to_string())
}
