# Architecture Overview

## High-Level Diagram

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                           OpenStudio AI Desktop App                           │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                     Tauri v2 Shell  (Rust)                              │  │
│  │                                                                         │  │
│  │   • Native window management          • IPC command registry            │  │
│  │   • SQLite database (rusqlite)        • Python process lifecycle        │  │
│  │   • File system access                • System tray                     │  │
│  │   • OS notifications                  • Auto-updater                    │  │
│  └──────────────────────────┬──────────────────────────────────────────────┘  │
│                             │  Tauri IPC (invoke)                             │
│  ┌──────────────────────────▼──────────────────────────────────────────────┐  │
│  │                  React + TypeScript Frontend                            │  │
│  │                                                                         │  │
│  │  Zustand stores    React Router    React Query    TailwindCSS           │  │
│  │                                                                         │  │
│  │  ┌───────────┐ ┌────────────┐ ┌──────────────┐ ┌────────────────────┐   │  │
│  │  │ Dashboard │ │  Projects  │ │   Workflows  │ │  Image Generator   │   │  │
│  │  └───────────┘ └────────────┘ │  (ReactFlow) │ └────────────────────┘   │  │
│  │  ┌───────────┐ ┌────────────┐ └──────────────┘ ┌────────────────────┐   │  │
│  │  │  Models   │ │   Assets   │ ┌──────────────┐ │   Voice Studio     │   │  │
│  │  └───────────┘ └────────────┘ │  Timeline    │ └────────────────────┘   │  │
│  │  ┌───────────┐ ┌────────────┐ └──────────────┘  ┌────────────────────┐  │  │
│  │  │  Plugins  │ │  Settings  │                   │   Video Studio     │  │  │
│  │  └───────────┘ └────────────┘                   └────────────────────┘  │  │
│  └──────────────────────────┬──────────────────────────────────────────────┘  │
│                             │  HTTP (localhost:8765)                          │
│  ┌──────────────────────────▼──────────────────────────────────────────────┐  │
│  │               Python 3.12 FastAPI Backend                               │  │
│  │                                                                         │  │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────┐   │  │
│  │  │  Job Queue      │  │  GPU Scheduler   │  │  Model Manager        │   │  │
│  │  │  (priority,     │  │  (VRAM budgeting,│  │  (registry, download, │   │  │
│  │  │  cancellation)  │  │  LRU eviction)   │  │  lifecycle)           │   │  │
│  │  └─────────────────┘  └──────────────────┘  └───────────────────────┘   │  │
│  │                                                                         │  │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────┐   │  │
│  │  │ Image Gen       │  │ Speech Recog.    │  │ TTS / Voice Clone     │   │  │
│  │  │ (Diffusers)     │  │ (Faster Whisper) │  │ (XTTS v2)             │   │  │
│  │  └─────────────────┘  └──────────────────┘  └───────────────────────┘   │  │
│  │                                                                         │  │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────┐   │  │
│  │  │ Upscaling       │  │ Background Rem.  │  │ Workflow Engine       │   │  │
│  │  │ (Real-ESRGAN)   │  │ (rembg / U2Net)  │  │ (DAG executor)        │   │  │
│  │  └─────────────────┘  └──────────────────┘  └───────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Tauri v2 Shell

The native desktop shell is written in Rust using Tauri v2. It is responsible for:
- Spawning and managing the Python backend process
- Providing a WebView for the React UI
- Handling IPC between the frontend and OS
- Persisting app-level data in SQLite (projects, jobs, models, settings)

### 2. React Frontend

The frontend is a single-page application built with:
- **React 18** — component model
- **TypeScript 5** — type safety
- **Vite** — fast dev server and bundler
- **TailwindCSS** — utility-first styling with a custom dark theme
- **Zustand + Immer** — simple, immutable state management
- **React Query** — server state caching
- **ReactFlow** — interactive node graph for workflow editing

### 3. Python AI Backend

A FastAPI server spawned as a sidecar process, responsible for all AI inference. Key subsystems:

#### GPUScheduler
- Tracks all loaded model pipelines and their VRAM usage
- Automatically evicts least-recently-used models when the VRAM budget is exceeded
- Serializes inference jobs to avoid concurrent OOM crashes
- Graceful fallback to CPU when no GPU is available

#### JobQueue
- Priority queue with async worker loop
- Supports cancellation via `asyncio.Event`
- Persists job status to SQLite for durable progress tracking
- Emits progress updates that the frontend polls

#### ModelManager
- Curated built-in registry of popular open-source models
- Downloads from HuggingFace Hub or direct URLs
- SHA256 verification (where provided)
- Tracks install paths per model for pipeline loading

#### WorkflowEngine
- Executes node graphs in topological order (Kahn's algorithm)
- Each node type maps to an async handler
- Supports cancellation mid-graph

### 4. Communication

```
Frontend → Tauri IPC (invoke) → Rust commands → Database / Python proxy
Frontend → HTTP (port 8765)   → FastAPI routes → AI pipelines
```

Sensitive operations (file system, window management) go through Tauri IPC.
AI inference operations go directly to the Python backend via HTTP.

### 5. Plugin System

Plugins are discovered at startup by scanning the `~/.openstudio/plugins/` directory. Each plugin is a Python package with:
- An `openstudio_plugin.json` manifest
- A Python class that extends `Plugin` from `openstudio_sdk`
- Optional TypeScript code for custom UI components

---

## Database Schema

The application uses two SQLite databases:

1. **Rust database** (`src-tauri/src/db/mod.rs`) — managed by Tauri, stores:
   - Projects
   - Settings
   - Models (installed status, paths)
   - Jobs (status, progress)
   - Plugins
   - Assets

2. **Python database** (shared via `~/.openstudio/openstudio.db`) — managed by FastAPI, stores:
   - Workflows
   - Model registry metadata

---

## Data Flow: Image Generation

```
User enters prompt → ImageGenerator.tsx
  → proxyRequest("POST", "/api/generate/image", params)
    → Tauri: proxy_request command
      → Python FastAPI POST /api/generate/image
        → JobQueue.submit_with_coro("image-generation", _run, params)
          → returns { job_id }
  → Frontend polls GET /api/jobs/{job_id} every 500ms
    → Python updates job.progress via callback_on_step_end
  → On completion: job.output_files = ["/path/to/image.png"]
  → Frontend displays image via asset:// protocol
```
