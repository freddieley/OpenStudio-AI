use serde::{Deserialize, Serialize};
use tauri::State;

use crate::state::AppState;

#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub tauri_version: String,
    pub build_date: String,
    pub debug: bool,
}

#[derive(Serialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub cpu_cores: usize,
    pub total_memory_mb: u64,
    pub available_memory_mb: u64,
    pub gpu_info: Vec<GpuInfo>,
}

#[derive(Serialize, Clone)]
pub struct GpuInfo {
    pub name: String,
    pub vram_mb: u64,
    pub available_vram_mb: u64,
    pub backend: String,
}

#[derive(Serialize)]
pub struct UpdateCheckResult {
    pub available: bool,
    pub version: Option<String>,
    pub release_notes: Option<String>,
    pub download_url: Option<String>,
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: "OpenStudio AI".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: "2.0".to_string(),
        build_date: env!("CARGO_PKG_VERSION").to_string(), // replace with build timestamp in CI
        debug: cfg!(debug_assertions),
    }
}

#[tauri::command]
pub async fn get_system_info(state: State<'_, AppState>) -> Result<SystemInfo, String> {
    // Query GPU info via Python backend if available
    let mut gpu_info = Vec::new();

    if let Some(backend) = state.python_backend.lock().as_ref() {
        if let Ok(response) = backend.request("GET", "/api/system/gpu", None).await {
            if let Some(gpus) = response.get("gpus").and_then(|g| g.as_array()) {
                for gpu in gpus {
                    gpu_info.push(GpuInfo {
                        name: gpu.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string(),
                        vram_mb: gpu.get("vram_mb").and_then(|v| v.as_u64()).unwrap_or(0),
                        available_vram_mb: gpu.get("available_vram_mb").and_then(|v| v.as_u64()).unwrap_or(0),
                        backend: gpu.get("backend").and_then(|v| v.as_str()).unwrap_or("cuda").to_string(),
                    });
                }
            }
        }
    }

    Ok(SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        cpu_cores: num_cpus::get(),
        total_memory_mb: total_memory_mb(),
        available_memory_mb: available_memory_mb(),
        gpu_info,
    })
}

#[tauri::command]
pub async fn check_for_updates() -> Result<UpdateCheckResult, String> {
    // Stub: integrate with tauri_plugin_updater in production
    Ok(UpdateCheckResult {
        available: false,
        version: None,
        release_notes: None,
        download_url: None,
    })
}

#[cfg(target_os = "windows")]
fn total_memory_mb() -> u64 {
    use std::mem::MaybeUninit;
    unsafe {
        let mut status: winapi::um::sysinfoapi::MEMORYSTATUSEX = MaybeUninit::zeroed().assume_init();
        status.dwLength = std::mem::size_of::<winapi::um::sysinfoapi::MEMORYSTATUSEX>() as u32;
        if winapi::um::sysinfoapi::GlobalMemoryStatusEx(&mut status) != 0 {
            return status.ullTotalPhys / 1024 / 1024;
        }
        0
    }
}

#[cfg(not(target_os = "windows"))]
fn total_memory_mb() -> u64 {
    0
}

#[cfg(target_os = "windows")]
fn available_memory_mb() -> u64 {
    use std::mem::MaybeUninit;
    unsafe {
        let mut status: winapi::um::sysinfoapi::MEMORYSTATUSEX = MaybeUninit::zeroed().assume_init();
        status.dwLength = std::mem::size_of::<winapi::um::sysinfoapi::MEMORYSTATUSEX>() as u32;
        if winapi::um::sysinfoapi::GlobalMemoryStatusEx(&mut status) != 0 {
            return status.ullAvailPhys / 1024 / 1024;
        }
        0
    }
}

#[cfg(not(target_os = "windows"))]
fn available_memory_mb() -> u64 {
    0
}
