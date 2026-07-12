# Plugin SDK Guide

This guide explains how to build plugins for OpenStudio AI using both the Python and TypeScript SDKs.

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
