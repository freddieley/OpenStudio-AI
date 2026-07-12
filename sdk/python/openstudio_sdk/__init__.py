"""
OpenStudio AI Plugin SDK — Python

Provides base classes and decorators for building plugins that extend
OpenStudio AI with custom nodes, AI models, effects, and tools.

Usage:
    from openstudio_sdk import Plugin, WorkflowNode, register_model
"""
from __future__ import annotations

import abc
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

__version__ = "0.1.0"
__all__ = [
    "Plugin",
    "WorkflowNode",
    "NodeInput",
    "NodeOutput",
    "PluginManifest",
    "register_node",
    "register_model",
]

logger = logging.getLogger(__name__)


# ─── Port types ───────────────────────────────────────────────────────────────

PortType = str  # "image" | "video" | "audio" | "text" | "number" | "boolean" | "any" | ...


@dataclass
class NodeInput:
    id: str
    name: str
    type: PortType
    required: bool = True
    default: Any = None
    description: str = ""
    multiple: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "required": self.required,
            "default": self.default,
            "description": self.description,
            "multiple": self.multiple,
        }


@dataclass
class NodeOutput:
    id: str
    name: str
    type: PortType
    description: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "name": self.name, "type": self.type, "description": self.description}


# ─── Node base class ──────────────────────────────────────────────────────────

class WorkflowNode(abc.ABC):
    """
    Base class for all custom workflow nodes.

    Subclass this and implement `execute()` to create a custom node
    that can be added to the OpenStudio AI workflow editor.

    Example::

        class MyBlurNode(WorkflowNode):
            id = "my-blur"
            name = "My Blur"
            category = "Image"
            description = "Apply Gaussian blur"
            version = "1.0.0"

            inputs = [NodeInput("image", "Image", "image")]
            outputs = [NodeOutput("image", "Image", "image")]

            async def execute(self, inputs, params):
                from PIL import Image, ImageFilter
                img = Image.open(inputs["image"])
                blurred = img.filter(ImageFilter.GaussianBlur(radius=params.get("radius", 5)))
                out = "/tmp/blurred.png"
                blurred.save(out)
                return {"image": out}
    """

    # ── Class-level metadata (override in subclass) ───────────────────────────
    id: str = ""
    name: str = ""
    category: str = "Custom"
    description: str = ""
    version: str = "1.0.0"
    author: str = ""
    color: str = "#64748b"
    icon: str = ""
    tags: list[str] = []
    deprecated: bool = False

    inputs: list[NodeInput] = []
    outputs: list[NodeOutput] = []

    # ─────────────────────────────────────────────────────────────────────────

    @abc.abstractmethod
    async def execute(
        self,
        inputs: dict[str, Any],
        params: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Execute the node.

        Args:
            inputs: Dict mapping input port IDs to values received from upstream nodes.
            params: Dict of static parameters configured on the node.

        Returns:
            Dict mapping output port IDs to output values.
        """
        ...

    def validate(self, inputs: dict[str, Any], params: dict[str, Any]) -> Optional[str]:
        """
        Validate inputs and params before execution.

        Returns an error message string if validation fails, or None if valid.
        """
        for inp in self.inputs:
            if inp.required and inp.id not in inputs and inp.id not in params:
                return f"Required input '{inp.name}' is missing"
        return None

    @classmethod
    def metadata(cls) -> dict[str, Any]:
        return {
            "id": cls.id,
            "name": cls.name,
            "category": cls.category,
            "description": cls.description,
            "version": cls.version,
            "author": cls.author,
            "color": cls.color,
            "icon": cls.icon,
            "tags": cls.tags,
            "deprecated": cls.deprecated,
        }

    @classmethod
    def to_definition(cls) -> dict[str, Any]:
        return {
            "metadata": cls.metadata(),
            "inputs": [i.to_dict() for i in cls.inputs],
            "outputs": [o.to_dict() for o in cls.outputs],
        }


# ─── Plugin manifest ──────────────────────────────────────────────────────────

@dataclass
class PluginManifest:
    id: str
    name: str
    version: str
    description: str
    author: str
    entry_point: str
    license: str = "MIT"
    homepage: str = ""
    permissions: list[str] = field(default_factory=list)
    min_app_version: str = "0.1.0"
    nodes: list[str] = field(default_factory=list)
    models: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "author": self.author,
            "entry_point": self.entry_point,
            "license": self.license,
            "homepage": self.homepage,
            "permissions": self.permissions,
            "min_app_version": self.min_app_version,
            "contributes": {
                "nodes": self.nodes,
                "models": self.models,
            },
        }

    def save(self, path: Path) -> None:
        path.write_text(json.dumps(self.to_dict(), indent=2))


# ─── Plugin base class ────────────────────────────────────────────────────────

class Plugin(abc.ABC):
    """
    Base class for all OpenStudio AI plugins.

    Example::

        class MyPlugin(Plugin):
            def get_manifest(self):
                return PluginManifest(
                    id="my-plugin",
                    name="My Plugin",
                    version="1.0.0",
                    description="Does something cool",
                    author="You",
                    entry_point="my_plugin:MyPlugin",
                )

            def get_nodes(self):
                return [MyCustomNode]
    """

    @abc.abstractmethod
    def get_manifest(self) -> PluginManifest:
        """Return the plugin manifest."""
        ...

    def get_nodes(self) -> list[type[WorkflowNode]]:
        """Return list of WorkflowNode subclasses provided by this plugin."""
        return []

    def get_models(self) -> list[dict[str, Any]]:
        """Return list of model registry entries provided by this plugin."""
        return []

    def on_load(self) -> None:
        """Called when the plugin is loaded. Override to run initialization."""

    def on_unload(self) -> None:
        """Called when the plugin is unloaded. Override for cleanup."""


# ─── Registry helpers ─────────────────────────────────────────────────────────

_NODE_REGISTRY: dict[str, type[WorkflowNode]] = {}
_MODEL_REGISTRY: list[dict[str, Any]] = []


def register_node(node_cls: type[WorkflowNode]) -> type[WorkflowNode]:
    """Decorator / function to register a WorkflowNode with the SDK."""
    _NODE_REGISTRY[node_cls.id] = node_cls
    logger.debug("Registered node: %s", node_cls.id)
    return node_cls


def register_model(model_def: dict[str, Any]) -> None:
    """Register a model definition with the SDK."""
    _MODEL_REGISTRY.append(model_def)
    logger.debug("Registered model: %s", model_def.get("id"))


def get_registered_nodes() -> dict[str, type[WorkflowNode]]:
    return dict(_NODE_REGISTRY)


def get_registered_models() -> list[dict[str, Any]]:
    return list(_MODEL_REGISTRY)
