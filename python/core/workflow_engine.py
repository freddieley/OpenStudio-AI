"""
Workflow execution engine — executes node graphs in topological order.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class WorkflowEngine:
    """
    Executes OpenStudio AI workflow graphs.

    Workflow graphs are directed acyclic graphs (DAGs) where:
    - Nodes represent operations (image gen, transcription, etc.)
    - Edges represent data flow between operations
    - Parameters are injected per-node at execution time

    Execution is topological — a node runs only after all its
    upstream dependencies have completed.
    """

    def __init__(
        self,
        db: Any,
        job_queue: Any,
        gpu_scheduler: Any,
        model_manager: Any,
    ) -> None:
        self._db = db
        self._job_queue = job_queue
        self._gpu = gpu_scheduler
        self._mm = model_manager

    async def execute(
        self,
        job: Any,
        nodes: list[dict[str, Any]],
        edges: list[dict[str, Any]],
        params: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Execute a workflow graph and return all node outputs.
        """
        if not nodes:
            return {}

        # Build adjacency: node_id → list of downstream node IDs
        # and reverse map: node_id → list of upstream node IDs
        downstream: dict[str, list[str]] = {n["id"]: [] for n in nodes}
        upstream: dict[str, list[str]] = {n["id"]: [] for n in nodes}

        for edge in edges:
            src = edge["source"]
            tgt = edge["target"]
            if src in downstream:
                downstream[src].append(tgt)
            if tgt in upstream:
                upstream[tgt].append(src)

        # Topological sort (Kahn's algorithm)
        in_degree = {n["id"]: len(upstream[n["id"]]) for n in nodes}
        ready = [n["id"] for n in nodes if in_degree[n["id"]] == 0]
        order: list[str] = []

        while ready:
            nid = ready.pop(0)
            order.append(nid)
            for succ in downstream[nid]:
                in_degree[succ] -= 1
                if in_degree[succ] == 0:
                    ready.append(succ)

        if len(order) != len(nodes):
            raise ValueError("Workflow graph contains a cycle")

        node_map = {n["id"]: n for n in nodes}
        outputs: dict[str, Any] = {}  # node_id → output dict
        total = len(order)

        for step, node_id in enumerate(order):
            if job.cancel_event.is_set():
                raise asyncio.CancelledError("Workflow cancelled")

            node = node_map[node_id]
            node_type: str = node.get("type", "workflowNode")
            node_data: dict = node.get("data", {})
            node_params: dict = {**node_data.get("params", {}), **params.get(node_id, {})}

            # Collect inputs from upstream outputs
            node_inputs = self._collect_inputs(node_id, edges, outputs, node_data)
            merged = {**node_params, **node_inputs}

            logger.debug("Executing node %s (type=%s)", node_id, node_data.get("metadata", {}).get("id"))

            try:
                node_output = await self._execute_node(
                    node_type_id=node_data.get("metadata", {}).get("id", ""),
                    params=merged,
                )
                outputs[node_id] = node_output
            except Exception as exc:
                logger.exception("Node %s failed: %s", node_id, exc)
                raise RuntimeError(f"Node '{node_data.get('metadata', {}).get('name', node_id)}' failed: {exc}") from exc

            job.progress = (step + 1) / total

        return outputs

    def _collect_inputs(
        self,
        node_id: str,
        edges: list[dict[str, Any]],
        outputs: dict[str, Any],
        node_data: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Collect outputs from upstream nodes and map them to this node's input ports.
        """
        collected: dict[str, Any] = {}
        for edge in edges:
            if edge["target"] == node_id:
                src_id = edge["source"]
                src_handle = edge.get("sourceHandle", "output")
                tgt_handle = edge.get("targetHandle", "input")
                if src_id in outputs and src_handle in outputs[src_id]:
                    collected[tgt_handle] = outputs[src_id][src_handle]
        return collected

    async def _execute_node(
        self,
        node_type_id: str,
        params: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Dispatch to the appropriate node handler.
        """
        handlers: dict[str, Any] = {
            "image-generate": self._node_image_generate,
            "text-input": self._node_text_input,
            "text-combine": self._node_text_combine,
            "speech-transcribe": self._node_speech_transcribe,
            "tts-generate": self._node_tts_generate,
            "image-upscale": self._node_image_upscale,
            "background-remove": self._node_background_remove,
        }

        handler = handlers.get(node_type_id)
        if handler is None:
            logger.warning("No handler for node type: %s", node_type_id)
            return {}

        return await handler(params)

    async def _node_text_input(self, params: dict) -> dict:
        return {"text": params.get("text", "")}

    async def _node_text_combine(self, params: dict) -> dict:
        a = str(params.get("text_a", ""))
        b = str(params.get("text_b", ""))
        sep = str(params.get("separator", ", "))
        return {"text": a + sep + b}

    async def _node_image_generate(self, params: dict) -> dict:
        from pathlib import Path
        from ai.image_generation import ImageGenerationPipeline

        model_id = params.get("model_id") or params.get("model", "")
        install_path = await self._mm.get_install_path(model_id)
        if not install_path:
            raise ValueError(f"Model '{model_id}' not installed")

        output_dir = Path.home() / ".openstudio" / "outputs" / "images"
        output_dir.mkdir(parents=True, exist_ok=True)

        pipeline = ImageGenerationPipeline(
            model_path=install_path,
            device=self._gpu.device,
        )

        class _FakeJob:
            progress = 0.0
            cancel_event = asyncio.Event()

        output_paths = await pipeline.generate(
            job=_FakeJob(),
            params=params,
            output_dir=output_dir,
        )
        return {"image": str(output_paths[0]) if output_paths else None}

    async def _node_speech_transcribe(self, params: dict) -> dict:
        from pathlib import Path
        from ai.speech_recognition import SpeechRecognitionPipeline

        class _FakeJob:
            progress = 0.0
            cancel_event = asyncio.Event()

        pipeline = SpeechRecognitionPipeline(device=self._gpu.device)
        result = await pipeline.transcribe(
            job=_FakeJob(),
            audio_path=Path(params["audio"]),
            language=params.get("language"),
        )
        return result

    async def _node_tts_generate(self, params: dict) -> dict:
        from pathlib import Path
        from ai.tts import TTSPipeline

        class _FakeJob:
            progress = 0.0
            cancel_event = asyncio.Event()

        output_dir = Path.home() / ".openstudio" / "outputs" / "audio"
        output_dir.mkdir(parents=True, exist_ok=True)

        pipeline = TTSPipeline(device=self._gpu.device)
        out = await pipeline.synthesize(
            job=_FakeJob(),
            text=params["text"],
            voice_path=Path(params["voice"]) if params.get("voice") else None,
            language=params.get("language", "en"),
            speed=float(params.get("speed", 1.0)),
            output_dir=output_dir,
        )
        return {"audio": str(out)}

    async def _node_image_upscale(self, params: dict) -> dict:
        from pathlib import Path
        from ai.upscaling import UpscalingPipeline

        class _FakeJob:
            progress = 0.0
            cancel_event = asyncio.Event()

        output_dir = Path.home() / ".openstudio" / "outputs" / "upscaled"
        output_dir.mkdir(parents=True, exist_ok=True)

        pipeline = UpscalingPipeline(device=self._gpu.device)
        out = await pipeline.upscale(
            job=_FakeJob(),
            image_path=Path(params["image"]),
            scale=int(params.get("scale", 4)),
            output_dir=output_dir,
        )
        return {"image": str(out)}

    async def _node_background_remove(self, params: dict) -> dict:
        from pathlib import Path
        from ai.background_removal import BackgroundRemovalPipeline

        class _FakeJob:
            progress = 0.0
            cancel_event = asyncio.Event()

        output_dir = Path.home() / ".openstudio" / "outputs" / "no-bg"
        output_dir.mkdir(parents=True, exist_ok=True)

        pipeline = BackgroundRemovalPipeline()
        out = await pipeline.remove_background(
            job=_FakeJob(),
            image_path=Path(params["image"]),
            output_dir=output_dir,
        )
        return {"image": str(out)}
