from __future__ import annotations

import logging
import sys
from pathlib import Path


def configure_logging(level: str = "INFO", dev: bool = False) -> None:
    """Configure the root logger for the OpenStudio backend."""
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]

    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    for handler in handlers:
        handler.setFormatter(formatter)
        root.addHandler(handler)

    # Suppress noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING if not dev else logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("diffusers").setLevel(logging.WARNING)
    logging.getLogger("transformers").setLevel(logging.WARNING)
    logging.getLogger("torch").setLevel(logging.WARNING)
