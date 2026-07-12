"""
Example plugin: Simple Invert Node
Demonstrates the minimal structure required for an OpenStudio AI plugin.
"""
from openstudio_sdk import Plugin, PluginManifest, WorkflowNode, NodeInput, NodeOutput


class InvertColorNode(WorkflowNode):
    """Inverts the colors of an image."""

    id = "example-invert-colors"
    name = "Invert Colors"
    category = "Image"
    description = "Invert all pixel values in an image"
    version = "1.0.0"
    author = "OpenStudio AI Example"
    color = "#ec4899"

    inputs = [
        NodeInput("image", "Image", "image", required=True),
    ]
    outputs = [
        NodeOutput("image", "Image", "image"),
    ]

    async def execute(self, inputs: dict, params: dict) -> dict:
        import asyncio
        from PIL import ImageOps, Image as PILImage
        from pathlib import Path
        import time

        image_path = inputs["image"]
        img = PILImage.open(image_path).convert("RGB")
        inverted = ImageOps.invert(img)

        out_dir = Path.home() / ".openstudio" / "outputs" / "processed"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"inverted_{int(time.time())}.png"
        inverted.save(str(out_path))

        return {"image": str(out_path)}


class ExamplePlugin(Plugin):
    def get_manifest(self) -> PluginManifest:
        return PluginManifest(
            id="example-plugin",
            name="Example Plugin",
            version="1.0.0",
            description="Demonstrates the OpenStudio AI plugin system",
            author="OpenStudio AI",
            entry_point="example_plugin:ExamplePlugin",
            license="MIT",
            nodes=["example-invert-colors"],
        )

    def get_nodes(self):
        return [InvertColorNode]

    def on_load(self) -> None:
        print("Example plugin loaded!")
