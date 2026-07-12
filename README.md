# OpenStudio AI

A fully local, open-source AI content creation studio for Windows, Linux, and macOS.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/Built_with-Tauri_v2-yellow)](https://tauri.app)
[![Python](https://img.shields.io/badge/Python-3.12+-green)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://typescriptlang.org)

---

## Overview

OpenStudio AI is a production-grade desktop application for AI-powered content creation. It runs entirely on your local machine — no cloud subscriptions, no data leakage, no vendor lock-in.

**Key capabilities:**

- AI image generation (Stable Diffusion, SDXL, Flux, custom LoRAs)
- AI video generation and frame interpolation
- Speech recognition (Faster Whisper)
- Text-to-speech and voice cloning
- Lip-sync generation
- Background removal and image upscaling
- Caption and script generation with local LLMs
- Node-based visual workflow editor
- Timeline-based video editor
- Plugin system for unlimited extensibility

---

## Architecture

```
┌─────────────────────────────────────────┐
│            Tauri v2 Shell (Rust)        │
│  ┌───────────────────────────────────┐  │
│  │   React + TypeScript Frontend     │  │
│  │   Zustand · React Router · Vite   │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │   Python FastAPI Backend          │  │
│  │   PyTorch · Diffusers · Whisper   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

See [docs/architecture.md](docs/architecture.md) for full documentation.

---

## Quick Start

### Prerequisites

- [Node.js 20+](https://nodejs.org)
- [Rust 1.77+](https://rustup.rs)
- [Python 3.12+](https://python.org)
- [Git](https://git-scm.com)
- A CUDA-capable GPU (optional but recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/openstudio-ai.git
cd openstudio-ai

# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Set up Python environment
cd python
python -m venv .venv
.venv\Scripts\activate     # Windows
# source .venv/bin/activate  # Linux/macOS
pip install -r requirements.txt
cd ..

# Run in development mode
npm run dev
```

### Production Build

```bash
npm run build
```

This produces a platform-native installer in `src-tauri/target/release/bundle/`.

---

## Project Structure

```
openstudio-ai/
├── src-tauri/          # Rust/Tauri shell
│   └── src/
│       ├── commands/   # IPC command handlers
│       ├── state/      # App state management
│       ├── python/     # Python sidecar manager
│       └── db/         # SQLite interface
├── frontend/           # React/TypeScript UI
│   └── src/
│       ├── components/ # Reusable UI components
│       ├── modules/    # Feature modules
│       ├── stores/     # Zustand state stores
│       ├── types/      # TypeScript type definitions
│       ├── hooks/      # React hooks
│       └── utils/      # Utility functions
├── python/             # Python AI backend
│   ├── core/           # Core services
│   ├── ai/             # AI model wrappers
│   ├── api/            # FastAPI routes
│   └── utils/          # Utilities
├── plugins/            # Built-in plugins
├── sdk/                # Plugin SDK
│   ├── python/         # Python plugin SDK
│   └── typescript/     # TypeScript plugin SDK
├── docs/               # Documentation
├── examples/           # Example workflows
├── tests/              # Test suites
├── models/             # Model registry (metadata only)
├── workflows/          # Built-in workflow templates
└── installer/          # Platform installers
```

---

## Plugins

OpenStudio AI has a full plugin system. Plugins can register:

- AI models and pipelines
- Workflow nodes
- Timeline effects
- Menu items and tool panels
- Importers and exporters
- Voice engines and video generators

See [docs/plugin-sdk.md](docs/plugin-sdk.md) to get started.

---

## Contributing

See [docs/contributing.md](docs/contributing.md).

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
