use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::State;
use uuid::Uuid;

use crate::state::AppState;

#[derive(Serialize, Deserialize, Debug)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub path: String,
    pub thumbnail: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub metadata: Value,
}

#[derive(Deserialize, Debug)]
pub struct CreateProjectInput {
    pub name: String,
    pub description: Option<String>,
    pub path: String,
    pub template: Option<String>,
}

#[tauri::command]
pub async fn list_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;

    let rows = db
        .query_many(
            "SELECT id, name, description, path, thumbnail, created_at, updated_at, metadata
             FROM projects
             ORDER BY updated_at DESC",
            &[],
        )
        .map_err(|e| e.to_string())?;

    let projects = rows
        .into_iter()
        .filter_map(|row| serde_json::from_value(row).ok())
        .collect();

    Ok(projects)
}

#[tauri::command]
pub async fn get_project(id: String, state: State<'_, AppState>) -> Result<Project, String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;

    let row = db
        .query_one(
            "SELECT id, name, description, path, thumbnail, created_at, updated_at, metadata
             FROM projects WHERE id = ?1",
            &[&id],
        )
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", id))?;

    serde_json::from_value(row).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_project(
    input: CreateProjectInput,
    state: State<'_, AppState>,
) -> Result<Project, String> {
    let id = Uuid::new_v4().to_string();
    let description = input.description.unwrap_or_default();

    // Create project directory
    std::fs::create_dir_all(&input.path)
        .map_err(|e| format!("Failed to create project directory: {}", e))?;

    // Write project manifest
    let manifest = json!({
        "id": id,
        "name": input.name,
        "version": "1.0.0",
        "created_at": chrono::Utc::now().to_rfc3339(),
        "template": input.template,
    });
    std::fs::write(
        std::path::Path::new(&input.path).join("project.json"),
        serde_json::to_string_pretty(&manifest).unwrap(),
    )
    .map_err(|e| format!("Failed to write project manifest: {}", e))?;

    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;

    db.execute(
        "INSERT INTO projects (id, name, description, path, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        &[&id, &input.name, &description, &input.path, &"{}"],
    )
    .map_err(|e| e.to_string())?;

    get_project(id, state).await
}

#[tauri::command]
pub async fn open_project(id: String, state: State<'_, AppState>) -> Result<Project, String> {
    let project = get_project(id.clone(), state.clone()).await?;

    // Update last opened timestamp
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;
    db.execute(
        "UPDATE projects SET updated_at = datetime('now') WHERE id = ?1",
        &[&id],
    )
    .map_err(|e| e.to_string())?;

    Ok(project)
}

#[tauri::command]
pub async fn save_project(
    id: String,
    metadata: Value,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;

    let metadata_str = serde_json::to_string(&metadata).map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE projects SET metadata = ?1, updated_at = datetime('now') WHERE id = ?2",
        &[&metadata_str, &id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_project(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock();
    let db = db.as_ref().ok_or("Database not initialized")?;

    db.execute("DELETE FROM projects WHERE id = ?1", &[&id])
        .map_err(|e| e.to_string())?;

    Ok(())
}
