use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use crate::state::AppState;

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Value, String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;

    let rows = db
        .query_many("SELECT key, value FROM settings", &[])
        .map_err(|e| e.to_string())?;

    let mut map = serde_json::Map::new();
    for row in rows {
        if let (Some(key), Some(val_str)) = (
            row.get("key").and_then(|v| v.as_str()),
            row.get("value").and_then(|v| v.as_str()),
        ) {
            let parsed: Value = serde_json::from_str(val_str).unwrap_or(Value::Null);
            map.insert(key.to_string(), parsed);
        }
    }

    Ok(Value::Object(map))
}

#[tauri::command]
pub async fn update_settings(
    updates: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;

    if let Some(obj) = updates.as_object() {
        for (key, value) in obj {
            let val_str = serde_json::to_string(value).map_err(|e| e.to_string())?;
            db.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at)
                 VALUES (?1, ?2, datetime('now'))",
                &[key, &val_str],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    drop(db);
    get_settings(state).await
}

#[tauri::command]
pub async fn reset_settings(state: State<'_, AppState>) -> Result<Value, String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;

    db.execute("DELETE FROM settings", &[]).map_err(|e| e.to_string())?;
    // Re-insert defaults (migration 001 handles this via INSERT OR IGNORE,
    // so we need to explicitly set them here)
    let defaults: &[(&str, &str)] = &[
        ("theme", r#""dark""#),
        ("language", r#""en""#),
        ("python_path", r#""python""#),
        ("backend_port", "8765"),
        ("gpu_enabled", "true"),
        ("gpu_vram_budget_mb", "8192"),
        ("default_image_width", "1024"),
        ("default_image_height", "1024"),
        ("output_directory", r#""""#),
        ("auto_save_interval_sec", "300"),
        ("telemetry_enabled", "false"),
        ("first_run", "false"),
    ];
    for (k, v) in defaults {
        db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            &[k, v],
        )
        .map_err(|e| e.to_string())?;
    }

    drop(db);
    get_settings(state).await
}

#[tauri::command]
pub fn get_settings_schema() -> Value {
    serde_json::json!({
        "theme": {
            "type": "string",
            "enum": ["dark", "light", "system"],
            "label": "Theme",
            "description": "Application color theme",
            "default": "dark",
            "group": "Appearance"
        },
        "language": {
            "type": "string",
            "label": "Language",
            "description": "Application display language",
            "default": "en",
            "group": "Appearance"
        },
        "python_path": {
            "type": "string",
            "label": "Python Executable",
            "description": "Path to Python 3.12+ interpreter",
            "default": "python",
            "group": "Backend"
        },
        "backend_port": {
            "type": "integer",
            "min": 1024,
            "max": 65535,
            "label": "Backend Port",
            "description": "Port for the Python AI backend server",
            "default": 8765,
            "group": "Backend"
        },
        "gpu_enabled": {
            "type": "boolean",
            "label": "Enable GPU Acceleration",
            "description": "Use GPU for AI inference (requires CUDA or ROCm)",
            "default": true,
            "group": "Performance"
        },
        "gpu_vram_budget_mb": {
            "type": "integer",
            "min": 1024,
            "max": 81920,
            "label": "VRAM Budget (MB)",
            "description": "Maximum VRAM to allocate for AI models",
            "default": 8192,
            "group": "Performance"
        },
        "default_image_width": {
            "type": "integer",
            "enum": [512, 768, 1024, 1280, 1536, 2048],
            "label": "Default Image Width",
            "description": "Default output image width in pixels",
            "default": 1024,
            "group": "Generation"
        },
        "default_image_height": {
            "type": "integer",
            "enum": [512, 768, 1024, 1280, 1536, 2048],
            "label": "Default Image Height",
            "description": "Default output image height in pixels",
            "default": 1024,
            "group": "Generation"
        },
        "output_directory": {
            "type": "path",
            "label": "Output Directory",
            "description": "Default directory for generated content",
            "default": "",
            "group": "Files"
        },
        "auto_save_interval_sec": {
            "type": "integer",
            "min": 0,
            "max": 3600,
            "label": "Auto-save Interval (seconds)",
            "description": "How often to auto-save projects (0 = disabled)",
            "default": 300,
            "group": "Files"
        }
    })
}
