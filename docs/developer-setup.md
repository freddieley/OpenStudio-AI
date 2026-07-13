# Developer Setup

## Prerequisites

| Tool | Minimum Version | Notes |
|---|---|---|
| Node.js | 20.0 | npm 10+ included |
| Rust | 1.77 | Install via [rustup.rs](https://rustup.rs) |
| Python | 3.12 | [python.org](https://python.org) |
| Git | any | |
| CUDA | 12.1+ | Optional — for GPU acceleration |

### Windows-Specific

Install [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (required for Rust on Windows).

Install [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) if not already present.

---

## Clone and Install

```bash
git clone https://github.com/your-org/openstudio-ai.git
cd openstudio-ai

# Install Node.js workspace dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Set up Python environment
cd python
python -m venv .venv

# Windows
.venv\Scripts\activate
# Linux/macOS
# source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
cd ..
```

### GPU Setup (NVIDIA)

```bash
# Install PyTorch with CUDA 12.1
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

### GPU Setup (AMD ROCm, Linux only)

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm6.0
```

---

## Running in Development

Start each of the three services in separate terminals **in this order**:

**Terminal 1 — Python AI backend:**
```bash
cd python
# Windows
.venv\Scripts\activate
# Linux/macOS
# source .venv/bin/activate
python main.py --dev
# → Backend ready on http://localhost:8765
```

**Terminal 2 — Vite frontend dev server:**
```bash
cd frontend
npm run dev
# → Frontend ready on http://localhost:5173
```

**Terminal 3 — Tauri shell** (always from workspace root, after Vite is ready):
```bash
# Must run from the workspace root, NOT from src-tauri/
cargo tauri dev
# → Compiles Rust and opens the app window
```

> **First compile:** Tauri downloads and compiles ~300 crates on first run. This takes 5–15 minutes. Subsequent runs are incremental (~10 seconds).

The Tauri window connects to the Vite dev server at `http://localhost:5173`. Hot-module replacement is active — frontend changes reflect immediately without restarting Tauri.

### Verifying the backend is healthy

```bash
# Health check
curl http://localhost:8765/health
# → {"status":"ok","version":"0.1.0"}

# Confirm model registry loaded
curl http://localhost:8765/api/models
# → {"models":[...],"total":9}
```

---

## Running Tests

```bash
# All tests
npm test

# Frontend only (Vitest)
cd frontend && npm test

# Python only (pytest)
cd python && pytest tests/ -v

# With coverage
cd python && pytest tests/ --cov=. --cov-report=html
```

---

## Building for Production

```bash
npm run build
```

This creates platform installers in `src-tauri/target/release/bundle/`:
- Windows: `*.msi` and `*.exe` (NSIS)
- macOS: `*.dmg` and `*.app`
- Linux: `*.deb`, `*.rpm`, `*.AppImage`

---

## Project Layout

```
src-tauri/src/
├── main.rs              # Tauri entry point
├── lib.rs               # App setup, plugin registration
├── commands/            # IPC command handlers (one file per domain)
├── state/               # Shared AppState
├── db/                  # SQLite schema + migrations
└── python/              # Python process manager

frontend/src/
├── main.tsx             # React entry point
├── App.tsx              # Router + layout
├── types/               # All TypeScript types (index.ts)
├── stores/              # Zustand stores (one per domain)
├── utils/               # ipc.ts (Tauri invoke wrappers), helpers.ts
├── hooks/               # React hooks
├── components/
│   ├── layout/          # AppLayout, Sidebar, TopBar, StatusBar
│   └── ui/              # Button, Input, Modal, Toast, CommandPalette, ...
├── modules/             # Feature modules (one folder per page)
│   ├── dashboard/
│   ├── project/
│   ├── model/
│   ├── workflow/        # WorkflowEditor + WorkflowNode + NodeRegistry
│   ├── image/
│   ├── video/
│   ├── audio/
│   ├── timeline/
│   ├── assets/
│   ├── jobs/
│   ├── plugins/
│   ├── settings/
│   └── export/
└── styles/
    └── globals.css

python/
├── main.py              # Entry point
├── requirements.txt
├── core/
│   ├── config.py        # Pydantic settings
│   ├── database.py      # Async SQLite wrapper
│   ├── gpu_scheduler.py # VRAM management
│   ├── job_queue.py     # Priority job queue
│   ├── model_manager.py # Model lifecycle
│   └── workflow_engine.py # DAG executor
├── ai/
│   ├── image_generation.py
│   ├── speech_recognition.py
│   ├── tts.py
│   ├── upscaling.py
│   └── background_removal.py
└── api/
    ├── app.py           # FastAPI factory
    └── routes/          # health, system, models, jobs, generate, workflows, plugins
```
