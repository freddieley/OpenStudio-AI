use parking_lot::Mutex;
use std::sync::Arc;
use tokio::sync::Mutex as AsyncMutex;

use crate::{db::Database, python::PythonBackend};

/// Central application state shared across Tauri commands.
///
/// `db` uses a synchronous `parking_lot::Mutex` (never held across `.await`).
/// `python_backend` uses `tokio::sync::Mutex` so its guard is `Send` and can
/// be held across async HTTP calls inside Tauri command futures.
#[derive(Default)]
pub struct AppState {
    pub db: Arc<Mutex<Option<Database>>>,
    pub python_backend: Arc<AsyncMutex<Option<PythonBackend>>>,
}

impl AppState {
    /// Synchronously lock the database (never held across .await).
    pub fn db(&self) -> impl std::ops::Deref<Target = Option<Database>> + '_ {
        self.db.lock()
    }
}
