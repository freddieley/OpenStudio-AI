import asyncio
import pytest


# Configure pytest-asyncio mode
def pytest_configure(config):
    config.addinivalue_line(
        "markers", "asyncio: mark test as async"
    )
