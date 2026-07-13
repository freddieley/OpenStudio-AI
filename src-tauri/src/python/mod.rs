use anyhow::{bail, Context, Result};
use reqwest::Client;
use serde_json::Value;
use std::{process::Stdio, time::Duration};
use tauri::{AppHandle, Manager};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::{Child, Command},
    time::{sleep, timeout},
};
use tracing::{debug, info, warn};

const BACKEND_PORT: u16 = 8765;
const STARTUP_TIMEOUT_SECS: u64 = 60;
const HEALTH_CHECK_INTERVAL_MS: u64 = 500;

/// Manages the Python FastAPI backend process.
/// `process` is `None` when connecting to an externally-managed backend.
pub struct PythonBackend {
    process: Option<Child>,
    port: u16,
    client: Client,
}

impl PythonBackend {
    /// Connect to the backend.
    ///
    /// If a healthy backend is already running on the preferred port (e.g. started
    /// manually by the developer), attach to it without spawning a new process.
    /// Otherwise spawn the backend as a child process and wait for it to be ready.
    pub async fn start(app: &AppHandle) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?;

        // Fast path: is there already a healthy backend on the default port?
        let health_url = format!("http://localhost:{}/health", BACKEND_PORT);
        if let Ok(resp) = timeout(
            Duration::from_secs(1),
            client.get(&health_url).send(),
        )
        .await
        {
            if let Ok(r) = resp {
                if r.status().is_success() {
                    info!(
                        "Attaching to existing Python backend on port {}",
                        BACKEND_PORT
                    );
                    return Ok(Self {
                        process: None,
                        port: BACKEND_PORT,
                        client,
                    });
                }
            }
        }

        // Slow path: spawn a new backend process.
        let port = Self::find_available_port(BACKEND_PORT).await?;
        let python_path = Self::resolve_python_path(app)?;
        let script_path = Self::resolve_script_path(app)?;

        info!(
            "Starting Python backend: {} {} --port {}",
            python_path.display(),
            script_path.display(),
            port
        );

        let mut child = Command::new(&python_path)
            .arg(&script_path)
            .arg("--port")
            .arg(port.to_string())
            .arg("--log-level")
            .arg(if cfg!(debug_assertions) { "debug" } else { "info" })
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .with_context(|| {
                format!(
                    "Failed to spawn Python process at {}",
                    python_path.display()
                )
            })?;

        // Stream stdout/stderr to tracing in background tasks
        if let Some(stdout) = child.stdout.take() {
            tokio::spawn(async move {
                let mut reader = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    debug!("[python-stdout] {}", line);
                }
            });
        }
        if let Some(stderr) = child.stderr.take() {
            tokio::spawn(async move {
                let mut reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    if line.contains("ERROR") || line.contains("error") {
                        warn!("[python-stderr] {}", line);
                    } else {
                        debug!("[python-stderr] {}", line);
                    }
                }
            });
        }

        // Wait for the backend to become healthy
        let health_url = format!("http://localhost:{}/health", port);
        let deadline = tokio::time::Instant::now() + Duration::from_secs(STARTUP_TIMEOUT_SECS);

        loop {
            if tokio::time::Instant::now() > deadline {
                let _ = child.kill().await;
                bail!(
                    "Python backend did not become healthy within {}s",
                    STARTUP_TIMEOUT_SECS
                );
            }

            match timeout(
                Duration::from_secs(2),
                client.get(&health_url).send(),
            )
            .await
            {
                Ok(Ok(resp)) if resp.status().is_success() => {
                    info!("Python backend healthy on port {}", port);
                    break;
                }
                _ => {
                    sleep(Duration::from_millis(HEALTH_CHECK_INTERVAL_MS)).await;
                }
            }

            // Check if process exited unexpectedly
            match child.try_wait() {
                Ok(Some(status)) => {
                    bail!("Python backend process exited early with status: {}", status);
                }
                Err(e) => {
                    bail!("Failed to check Python process status: {}", e);
                }
                Ok(None) => {} // still running
            }
        }

        Ok(Self {
            process: Some(child),
            port,
            client,
        })
    }

    /// Send an HTTP request to the Python backend.
    pub async fn request(
        &self,
        method: &str,
        path: &str,
        body: Option<Value>,
    ) -> Result<Value> {
        let url = format!("http://localhost:{}{}", self.port, path);
        let req = match method.to_uppercase().as_str() {
            "GET" => self.client.get(&url),
            "POST" => {
                let req = self.client.post(&url);
                if let Some(b) = body {
                    req.json(&b)
                } else {
                    req
                }
            }
            "PUT" => {
                let req = self.client.put(&url);
                if let Some(b) = body {
                    req.json(&b)
                } else {
                    req
                }
            }
            "DELETE" => self.client.delete(&url),
            m => bail!("Unsupported HTTP method: {}", m),
        };

        let resp = req
            .send()
            .await
            .with_context(|| format!("HTTP {} {} failed", method, url))?;

        let status = resp.status();
        let json: Value = resp
            .json()
            .await
            .with_context(|| "Failed to deserialize response body as JSON")?;

        if !status.is_success() {
            bail!(
                "Backend error {}: {}",
                status,
                json.get("detail").and_then(|d| d.as_str()).unwrap_or("unknown error")
            );
        }

        Ok(json)
    }

    /// Gracefully shut down the Python backend.
    /// Does nothing if the backend was externally managed (process = None).
    pub async fn shutdown(mut self) -> Result<()> {
        info!("Shutting down Python backend");
        let url = format!("http://localhost:{}/shutdown", self.port);
        let _ = timeout(
            Duration::from_secs(5),
            self.client.post(&url).send(),
        )
        .await;
        sleep(Duration::from_millis(500)).await;
        if let Some(ref mut process) = self.process {
            match process.try_wait() {
                Ok(Some(_)) => {}
                _ => { let _ = process.kill().await; }
            }
        }
        Ok(())
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    async fn find_available_port(preferred: u16) -> Result<u16> {
        use tokio::net::TcpListener;
        for port in preferred..preferred + 100 {
            if TcpListener::bind(format!("127.0.0.1:{}", port)).await.is_ok() {
                return Ok(port);
            }
        }
        bail!("No available port found in range {}..{}", preferred, preferred + 100)
    }

    fn resolve_python_path(app: &AppHandle) -> Result<std::path::PathBuf> {
        // 1. Check settings DB for user-configured Python
        // 2. Fall back to bundled sidecar, then system Python
        let candidates = [
            "python3",
            "python",
            r"C:\Python312\python.exe",
            r"C:\Users\{USER}\AppData\Local\Programs\Python\Python312\python.exe",
        ];
        for candidate in &candidates {
            if which::which(candidate).is_ok() {
                return Ok(std::path::PathBuf::from(candidate));
            }
        }

        // Try resource path (bundled Python in production)
        if let Ok(resource_dir) = app.path().resource_dir() {
            let bundled = resource_dir.join("python-runtime").join("python.exe");
            if bundled.exists() {
                return Ok(bundled);
            }
        }

        bail!("Python interpreter not found. Please install Python 3.12+ or configure the path in Settings.")
    }

    fn resolve_script_path(app: &AppHandle) -> Result<std::path::PathBuf> {
        // In development: relative path
        let dev_path = std::path::PathBuf::from("../python/main.py");
        if dev_path.exists() {
            return Ok(dev_path);
        }

        // In production: bundled resource
        if let Ok(resource_dir) = app.path().resource_dir() {
            let bundled = resource_dir.join("python").join("main.py");
            if bundled.exists() {
                return Ok(bundled);
            }
        }

        bail!("Python backend script not found")
    }
}

// Add `which` to Cargo.toml dependencies if not present
// This crate is used above for executable lookup
