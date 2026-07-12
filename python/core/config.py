from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, loaded from environment variables + defaults."""

    model_config = SettingsConfigDict(
        env_prefix="OPENSTUDIO_",
        env_file=".env",
        extra="ignore",
    )

    # Server
    backend_port: int = Field(default=8765, description="HTTP port for the FastAPI server")
    backend_host: str = Field(default="127.0.0.1", description="Bind host")
    dev_mode: bool = Field(default=False, description="Enable development mode")

    # Data directories
    data_dir: Path = Field(
        default_factory=lambda: Path.home() / ".openstudio",
        description="Root data directory",
    )

    @property
    def models_dir(self) -> Path:
        return self.data_dir / "models"

    @property
    def projects_dir(self) -> Path:
        return self.data_dir / "projects"

    @property
    def workflows_dir(self) -> Path:
        return self.data_dir / "workflows"

    @property
    def plugins_dir(self) -> Path:
        return self.data_dir / "plugins"

    @property
    def cache_dir(self) -> Path:
        return self.data_dir / "cache"

    @property
    def logs_dir(self) -> Path:
        return self.data_dir / "logs"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "openstudio.db"

    # GPU
    gpu_enabled: bool = Field(default=True, description="Enable GPU acceleration")
    gpu_device: str = Field(default="auto", description="CUDA device index or 'auto' or 'cpu'")
    gpu_vram_budget_mb: int = Field(default=8192, description="Max VRAM budget in MB")
    low_vram_mode: bool = Field(default=False, description="Enable low-VRAM optimizations")

    # Generation defaults
    default_image_width: int = Field(default=1024)
    default_image_height: int = Field(default=1024)
    default_steps: int = Field(default=20)
    default_cfg_scale: float = Field(default=7.5)

    # Whisper
    whisper_model_size: str = Field(default="base", description="Whisper model size")
    whisper_device: str = Field(default="auto")
    whisper_compute_type: str = Field(default="float16")

    # HuggingFace
    hf_token: Optional[str] = Field(default=None, description="HuggingFace API token")
    hf_cache_dir: Optional[Path] = Field(default=None)

    def ensure_dirs(self) -> None:
        """Create all data directories if they don't exist."""
        for d in [
            self.data_dir,
            self.models_dir,
            self.projects_dir,
            self.workflows_dir,
            self.plugins_dir,
            self.cache_dir,
            self.logs_dir,
        ]:
            d.mkdir(parents=True, exist_ok=True)
