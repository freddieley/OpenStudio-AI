use tauri::Manager;
use tracing::{info, warn};

mod commands;
mod db;
mod python;
mod state;

pub use state::AppState;

pub fn run() {
    info!("OpenStudio AI starting up");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Stdout,
                ))
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Webview,
                ))
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("openstudio".into()),
                    },
                ))
                .max_file_size(10_485_760)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .build(),
        )
        .manage(state::AppState::default())
        .setup(|app| {
            let handle = app.handle().clone();

            // Initialize database
            let app_state = handle.state::<AppState>();
            let data_dir = handle
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            std::fs::create_dir_all(&data_dir)?;

            {
                let mut db_guard = app_state.db.lock();
                *db_guard = Some(
                    db::Database::open(data_dir.join("openstudio.db"))
                        .expect("failed to open database"),
                );
            }
            info!("Database initialized at {:?}", data_dir.join("openstudio.db"));

            // Start Python backend sidecar
            let py_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                match python::PythonBackend::start(&py_handle).await {
                    Ok(backend) => {
                        let state = py_handle.state::<AppState>();
                        *state.python_backend.lock().await = Some(backend);
                        info!("Python backend started successfully");
                        // Show main window after backend is ready
                        if let Some(win) = py_handle.get_webview_window("main") {
                            let _ = win.show();
                        }
                    }
                    Err(e) => {
                        warn!("Python backend failed to start: {}. Running in limited mode.", e);
                        if let Some(win) = py_handle.get_webview_window("main") {
                            let _ = win.show();
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Application
            commands::app::get_app_info,
            commands::app::get_system_info,
            commands::app::check_for_updates,
            // Project
            commands::project::list_projects,
            commands::project::create_project,
            commands::project::open_project,
            commands::project::save_project,
            commands::project::delete_project,
            commands::project::get_project,
            // Models
            commands::model::list_models,
            commands::model::get_model,
            commands::model::install_model,
            commands::model::uninstall_model,
            commands::model::get_model_install_progress,
            commands::model::cancel_model_install,
            commands::model::refresh_model_registry,
            // Jobs
            commands::job::list_jobs,
            commands::job::get_job,
            commands::job::cancel_job,
            commands::job::clear_completed_jobs,
            // Settings
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::reset_settings,
            commands::settings::get_settings_schema,
            // Plugins
            commands::plugin::list_plugins,
            commands::plugin::enable_plugin,
            commands::plugin::disable_plugin,
            commands::plugin::install_plugin,
            commands::plugin::uninstall_plugin,
            commands::plugin::get_plugin_marketplace,
            // Assets
            commands::asset::list_assets,
            commands::asset::import_asset,
            commands::asset::delete_asset,
            commands::asset::get_asset_thumbnail,
            // Workflows
            commands::workflow::list_workflows,
            commands::workflow::save_workflow,
            commands::workflow::load_workflow,
            commands::workflow::delete_workflow,
            commands::workflow::execute_workflow,
            // Python proxy
            commands::python::proxy_request,
            commands::python::get_backend_status,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<AppState>();
                tauri::async_runtime::block_on(async move {
                    // Shutdown Python backend gracefully
                    if let Some(backend) = state.python_backend.lock().await.take() {
                        let _ = backend.shutdown().await;
                    }
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running OpenStudio AI");
}
