use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;

#[derive(Serialize, Deserialize, Debug)]
pub struct AssetRecord {
    pub id: String,
    pub name: String,
    pub r#type: String,
    pub mime_type: String,
    pub path: String,
    pub thumbnail_path: Option<String>,
    pub size_bytes: i64,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub duration_sec: Option<f64>,
    pub project_id: Option<String>,
    pub tags: Value,
    pub metadata: Value,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct ImportAssetInput {
    pub path: String,
    pub project_id: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[tauri::command]
pub async fn list_assets(
    project_id: Option<String>,
    asset_type: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<AssetRecord>, String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;

    let mut sql = "SELECT * FROM assets WHERE 1=1".to_string();
    if let Some(pid) = &project_id {
        sql.push_str(&format!(" AND project_id = '{}'", pid.replace('\'', "''")));
    }
    if let Some(t) = &asset_type {
        sql.push_str(&format!(" AND type = '{}'", t.replace('\'', "''")));
    }
    sql.push_str(" ORDER BY created_at DESC");

    let rows = db.query_many(&sql, &[]).map_err(|e| e.to_string())?;
    let assets = rows
        .into_iter()
        .filter_map(|row| serde_json::from_value(row).ok())
        .collect();

    Ok(assets)
}

#[tauri::command]
pub async fn import_asset(
    input: ImportAssetInput,
    state: State<'_, AppState>,
) -> Result<AssetRecord, String> {
    let path = std::path::Path::new(&input.path);
    if !path.exists() {
        return Err(format!("File not found: {}", input.path));
    }

    let metadata = std::fs::metadata(path).map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let asset_type = match ext.as_str() {
        "png" | "jpg" | "jpeg" | "webp" | "bmp" | "tiff" | "gif" => "image",
        "mp4" | "mov" | "avi" | "mkv" | "webm" => "video",
        "mp3" | "wav" | "ogg" | "flac" | "aac" => "audio",
        "safetensors" | "ckpt" | "pt" | "pth" | "bin" => "model",
        _ => "file",
    };

    let tags_json = serde_json::to_string(&input.tags.unwrap_or_default())
        .map_err(|e| e.to_string())?;

    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;

    db.execute(
        "INSERT INTO assets (id, name, type, path, size_bytes, project_id, tags)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        &[
            &id,
            &name,
            &asset_type,
            &input.path,
            &(metadata.len() as i64),
            &input.project_id.as_deref().unwrap_or(""),
            &tags_json,
        ],
    )
    .map_err(|e| e.to_string())?;

    let row = db
        .query_one("SELECT * FROM assets WHERE id = ?1", &[&id])
        .map_err(|e| e.to_string())?
        .ok_or("Asset not found after insert")?;

    serde_json::from_value(row).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_asset(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;
    db.execute("DELETE FROM assets WHERE id = ?1", &[&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_asset_thumbnail(
    id: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;
    let row = db
        .query_one("SELECT thumbnail_path FROM assets WHERE id = ?1", &[&id])
        .map_err(|e| e.to_string())?;

    Ok(row
        .and_then(|r| r.get("thumbnail_path").cloned())
        .and_then(|v| {
            if v.is_null() {
                None
            } else {
                v.as_str().map(|s| s.to_string())
            }
        }))
}
