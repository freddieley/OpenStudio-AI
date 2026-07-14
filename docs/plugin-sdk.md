# Plugin SDK Guide

This guide explains how to build plugins for OpenStudio AI using both the Python and TypeScript SDKs.

---

## Built-in Model Registry

9 models are pre-registered at backend startup. No installation required to see them — open the **Model Manager** and they appear immediately. Click **Install** to download any of them.

| ID | Name | Type | Size |
|---|---|---|---|
| `whisper-base` | Whisper Base | speech-recognition | 145 MB |
| `whisper-large-v3` | Whisper Large v3 | speech-recognition | 1.55 GB |
| `sdxl-base-1.0` | Stable Diffusion XL | image-generation | 6.9 GB |
| `sdxl-turbo` | SDXL-Turbo | image-generation | 6.9 GB |
| `flux-schnell` | FLUX.1 schnell | image-generation | 23.8 GB |
| `real-esrgan-x4plus` | Real-ESRGAN x4+ | upscaling | 67 MB |
| `u2net-rembg` | U-2-Net | background-removal | 176 MB |
| `xtts-v2` | XTTS v2 | tts | 1.8 GB |
| `llama-3.1-8b-gguf` | Llama 3.1 8B Q4 | llm | 4.9 GB |

Add custom models to the registry by editing `python/core/model_manager.py` → `BUILTIN_REGISTRY`, or via a plugin.

---

## Workflow Nodes

The node editor ships with these built-in node types (add via toolbar **Add Node** button or double-click the canvas):

| Node ID | Name | Category |
|---|---|---|
| `text-input` | Text Input | Text |
| `text-combine` | Combine Text | Text |
| `llm-generate` | LLM Generate | Text |
| `image-generate` | Generate Image | Image |
| `image-upscale` | Upscale Image | Image |
| `background-remove` | Remove Background | Image |
| `speech-transcribe` | Transcribe Audio | Audio |
| `tts-generate` | Text to Speech | Audio |
| `video-interpolate` | Frame Interpolation | Video |
| `lip-sync` | Lip Sync | Video |
| `load-image` | Load Image | I/O |
| `save-image` | Save Image | I/O |

---

## What Plugins Can Do

Plugins may register:

- **Workflow nodes** — custom processing steps for the node editor
- **AI models** — model registry entries pointing to custom weights
- **Menu items** — entries in the application menu
- **Importers/Exporters** — custom file format support
- **UI panels** — custom dockable panels (via TypeScript SDK)

---

## Python Plugin

### Directory Structure

```
my-plugin/
├── openstudio_plugin.json   # Manifest
├── my_plugin/
│   ├── __init__.py
│   └── nodes.py             # Custom workflow nodes
```

### Manifest (`openstudio_plugin.json`)

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Adds custom workflow nodes",
  "author": "Your Name",
  "license": "MIT",
  "entry_point": "my_plugin:MyPlugin",
  "permissions": [],
  "contributes": {
    "nodes": ["my-blur-node"]
  },
  "min_app_version": "0.1.0"
}
```

### Plugin Class

```python
from openstudio_sdk import Plugin, PluginManifest
from .nodes import MyBlurNode

class MyPlugin(Plugin):
    def get_manifest(self) -> PluginManifest:
        return PluginManifest(
            id="my-plugin",
            name="My Plugin",
            version="1.0.0",
            description="Adds custom workflow nodes",
            author="Your Name",
            entry_point="my_plugin:MyPlugin",
        )

    def get_nodes(self):
        return [MyBlurNode]
```

### Custom Node

```python
from openstudio_sdk import WorkflowNode, NodeInput, NodeOutput

class MyBlurNode(WorkflowNode):
    id = "my-blur-node"
    name = "My Blur"
    category = "Image"
    description = "Apply Gaussian blur to an image"
    version = "1.0.0"
    author = "Your Name"
    color = "#7c3aed"

    inputs = [
        NodeInput("image", "Image", "image", required=True),
        NodeInput("radius", "Radius", "number", required=False, default=5),
    ]
    outputs = [
        NodeOutput("image", "Image", "image"),
    ]

    async def execute(self, inputs, params):
        from PIL import Image, ImageFilter
        img = Image.open(inputs["image"])
        radius = float(params.get("radius", 5))
        blurred = img.filter(ImageFilter.GaussianBlur(radius=radius))
        out_path = "/tmp/blurred.png"
        blurred.save(out_path)
        return {"image": out_path}
```

### Installation

Place the plugin directory in `~/.openstudio/plugins/`. OpenStudio AI will discover it on next launch.

---

## TypeScript Plugin (Frontend)

```typescript
import { definePlugin, defineNode } from '@openstudio-ai/sdk';

const myBlurNodeDef = defineNode({
  metadata: {
    id: 'my-blur-node',
    name: 'My Blur',
    category: 'Image',
    description: 'Apply Gaussian blur to an image',
    version: '1.0.0',
    author: 'Your Name',
    color: '#7c3aed',
  },
  inputs: [
    { id: 'image', name: 'Image', type: 'image', required: true },
    { id: 'radius', name: 'Radius', type: 'number', required: false, default: 5 },
  ],
  outputs: [
    { id: 'image', name: 'Image', type: 'image', required: false },
  ],
});

export default definePlugin({
  manifest: {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    description: 'Adds custom workflow nodes',
    author: 'Your Name',
    license: 'MIT',
    entry_point: 'my-plugin',
    permissions: [],
    contributes: { nodes: ['my-blur-node'] },
  },
  nodes: [myBlurNodeDef],
  onLoad() {
    console.log('My Plugin loaded!');
  },
});
```

---

## Permissions

Plugins declare required permissions in their manifest:

| Permission | Description |
|---|---|
| `fs.read` | Read files from disk |
| `fs.write` | Write files to disk |
| `network` | Make HTTP requests |
| `gpu` | Access GPU resources |
| `models` | Register/load AI models |

---

## Publishing

Share your plugin on GitHub with the topic `openstudio-plugin`. The community plugin browser will discover it automatically.
