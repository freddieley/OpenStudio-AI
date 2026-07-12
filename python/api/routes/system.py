import platform
from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/gpu")
async def get_gpu_info(request: Request) -> dict:
    gpu_scheduler = request.app.state.gpu_scheduler
    return {"gpus": gpu_scheduler.get_gpu_info()}


@router.get("/info")
async def get_system_info(request: Request) -> dict:
    import psutil

    gpu_scheduler = request.app.state.gpu_scheduler
    mem = psutil.virtual_memory()

    return {
        "os": platform.system(),
        "os_version": platform.version(),
        "arch": platform.machine(),
        "cpu_cores": psutil.cpu_count(logical=True),
        "total_memory_mb": mem.total // (1024 * 1024),
        "available_memory_mb": mem.available // (1024 * 1024),
        "gpu_device": gpu_scheduler.device,
        "gpu_info": gpu_scheduler.get_gpu_info(),
        "vram_budget_mb": gpu_scheduler._vram_budget_mb,
        "vram_used_mb": gpu_scheduler.get_used_vram_mb(),
    }
