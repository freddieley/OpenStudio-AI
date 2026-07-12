"""
OpenStudio AI — Python backend entry point.

Starts a FastAPI server on the specified port and registers all routers.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import signal
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn

# Ensure the package root is on sys.path when run directly
sys.path.insert(0, str(Path(__file__).parent))

from core.config import Settings
from core.logging_setup import configure_logging
from api.app import create_app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="OpenStudio AI Backend")
    parser.add_argument("--port", type=int, default=8765, help="Port to listen on")
    parser.add_argument(
        "--log-level",
        default="info",
        choices=["debug", "info", "warning", "error"],
        help="Log level",
    )
    parser.add_argument("--dev", action="store_true", help="Enable development mode")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # Configure logging first
    configure_logging(level=args.log_level.upper(), dev=args.dev)
    logger = logging.getLogger("openstudio")
    logger.info("OpenStudio AI backend starting on port %d", args.port)

    # Load settings
    settings = Settings()
    settings.backend_port = args.port
    settings.dev_mode = args.dev

    # Create and run the FastAPI application
    app = create_app(settings)

    config = uvicorn.Config(
        app,
        host=args.host,
        port=args.port,
        log_level=args.log_level,
        access_log=args.dev,
        loop="asyncio",
        # Allow only local connections for security
        limit_concurrency=50,
    )
    server = uvicorn.Server(config)

    # Handle graceful shutdown on SIGTERM/SIGINT
    def _shutdown(sig: int, frame: object) -> None:
        logger.info("Received signal %d, shutting down...", sig)
        server.should_exit = True

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    server.run()
    logger.info("Backend shutdown complete")


if __name__ == "__main__":
    main()
