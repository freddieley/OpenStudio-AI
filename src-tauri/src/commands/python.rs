use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use crate::state::AppState;

#[derive(Deserialize)]
pub struct ProxyRequest {
    pub method: String,
    pub path: String,
    pub body: Option<Value>,
}

#[derive(Serialize)]
pub struct BackendStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub version: Option<String>,
    pub healthy: bool,
}

#[tauri::command]
pub async fn proxy_request(
    request: ProxyRequest,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let backend_guard = state.python_backend.lock();
    let backend = backend_guard
        .as_ref()
        .ok_or("Python backend not available")?;

    backend
        .request(&request.method, &request.path, request.body)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_backend_status(state: State<'_, AppState>) -> Result<BackendStatus, String> {
    let backend_guard = state.python_backend.lock();

    match backend_guard.as_ref() {
        None => Ok(BackendStatus {
            running: false,
            port: None,
            version: None,
            healthy: false,
        }),
        Some(backend) => {
            let port = backend.port();
            drop(backend_guard);

            // Try a health check
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(2))
                .build()
                .map_err(|e| e.to_string())?;

            let health_url = format!("http://localhost:{}/health", port);
            match client.get(&health_url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    let body: Value = resp.json().await.unwrap_or(Value::Null);
                    Ok(BackendStatus {
                        running: true,
                        port: Some(port),
                        version: body
                            .get("version")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        healthy: true,
                    })
                }
                _ => Ok(BackendStatus {
                    running: true,
                    port: Some(port),
                    version: None,
                    healthy: false,
                }),
            }
        }
    }
}
