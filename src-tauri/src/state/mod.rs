use parking_lot::Mutex;
use std::sync::Arc;

use crate::{db::Database, python::PythonBackend};

/// Central application state shared across Tauri commands.
#[derive(Default)]
pub struct AppState {
    pub db: Arc<Mutex<Option<Database>>>,
    pub python_backend: Arc<Mutex<Option<PythonBackend>>>,
}

impl AppState {
    /// Returns a reference-counted handle to the database.
    /// Panics if the database has not been initialized.
    pub fn db(&self) -> impl std::ops::Deref<Target = Option<Database>> + '_ {
        self.db.lock()
    }
}
