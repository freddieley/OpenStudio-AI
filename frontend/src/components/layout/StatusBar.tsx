import { useAppStore } from '@/stores/app.store';
import { useJobStore } from '@/stores/job.store';
import { useProjectStore } from '@/stores/project.store';
import { clsx } from 'clsx';

export default function StatusBar() {
  const appInfo = useAppStore((s) => s.appInfo);
  const backendStatus = useAppStore((s) => s.backendStatus);
  const systemInfo = useAppStore((s) => s.systemInfo);
  const activeProject = useProjectStore((s) => s.activeProject);
  const jobs = useJobStore((s) => s.jobs);

  const runningJobs = jobs.filter((j) => j.status === 'running');
  const firstRunning = runningJobs[0];

  const gpuName = systemInfo?.gpu_info[0]?.name;
  const vramTotal = systemInfo?.gpu_info[0]?.vram_mb;

  return (
    <footer className="flex items-center gap-4 px-3 h-6 border-t border-studio-border bg-studio-panel shrink-0 text-[11px] text-studio-text-muted select-none overflow-hidden">
      {/* App version */}
      <span className="text-studio-text-muted/60">v{appInfo?.version ?? '?'}</span>

      <div className="w-px h-3 bg-studio-border" />

      {/* Active project */}
      {activeProject ? (
        <span className="text-studio-text truncate max-w-[160px]">{activeProject.name}</span>
      ) : (
        <span className="italic">No project</span>
      )}

      <div className="flex-1" />

      {/* Running job progress */}
      {firstRunning && (
        <div className="flex items-center gap-2 max-w-[240px]">
          <span className="w-1.5 h-1.5 rounded-full bg-studio-accent animate-pulse" />
          <span className="truncate">{firstRunning.type}</span>
          <div className="w-16 h-1 rounded-full bg-studio-border overflow-hidden">
            <div
              className="h-full bg-studio-accent transition-all"
              style={{ width: `${Math.round(firstRunning.progress * 100)}%` }}
            />
          </div>
          <span>{Math.round(firstRunning.progress * 100)}%</span>
        </div>
      )}

      {/* GPU info */}
      {gpuName && (
        <>
          <div className="w-px h-3 bg-studio-border" />
          <span className="truncate max-w-[120px]" title={gpuName}>
            {gpuName.replace('NVIDIA GeForce ', '').replace('AMD Radeon ', '')}
          </span>
          {vramTotal && <span>{vramTotal >= 1024 ? `${Math.round(vramTotal / 1024)}GB` : `${vramTotal}MB`}</span>}
        </>
      )}

      <div className="w-px h-3 bg-studio-border" />

      {/* Backend status */}
      <div className="flex items-center gap-1">
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full',
            backendStatus.healthy ? 'bg-studio-success' : 'bg-studio-error'
          )}
        />
        <span>{backendStatus.healthy ? 'Backend ready' : 'Backend offline'}</span>
      </div>
    </footer>
  );
}
