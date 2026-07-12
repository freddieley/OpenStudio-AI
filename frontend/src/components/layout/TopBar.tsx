import { PanelLeft, Search, Bell, Circle } from 'lucide-react';
import { useAppStore } from '@/stores/app.store';
import { useJobStore } from '@/stores/job.store';
import { clsx } from 'clsx';

interface TopBarProps {
  onToggleSidebar: () => void;
}

export default function TopBar({ onToggleSidebar }: TopBarProps) {
  const appInfo = useAppStore((s) => s.appInfo);
  const openCommandPalette = useAppStore((s) => s.openCommandPalette);
  const backendStatus = useAppStore((s) => s.backendStatus);
  const activeJobs = useJobStore((s) => s.getActiveJobs());

  return (
    <header
      className="flex items-center gap-2 px-2 h-9 border-b border-studio-border bg-studio-panel shrink-0 select-none"
      data-tauri-drag-region
    >
      {/* Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="p-1 rounded hover:bg-studio-surface text-studio-text-muted hover:text-studio-text transition-colors"
        title="Toggle Sidebar"
      >
        <PanelLeft className="w-4 h-4" />
      </button>

      {/* App name */}
      <span className="text-sm font-semibold text-studio-text tracking-tight pr-2">
        OpenStudio <span className="text-studio-accent">AI</span>
      </span>

      {/* Spacer */}
      <div className="flex-1" data-tauri-drag-region />

      {/* Search / Command Palette */}
      <button
        onClick={openCommandPalette}
        className="flex items-center gap-2 px-2 py-1 rounded bg-studio-surface border border-studio-border text-studio-text-muted hover:text-studio-text hover:border-studio-muted transition-colors text-xs"
        style={{ minWidth: 160 }}
      >
        <Search className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">Search commands...</span>
        <kbd className="text-[10px] font-mono bg-studio-border px-1 rounded">⌘K</kbd>
      </button>

      {/* Active job indicator */}
      {activeJobs.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-studio-surface border border-studio-border text-xs text-studio-text-muted">
          <span className="w-2 h-2 rounded-full bg-studio-accent animate-pulse" />
          <span>{activeJobs.length} running</span>
        </div>
      )}

      {/* Backend status indicator */}
      <div
        className="flex items-center gap-1 text-xs px-1"
        title={backendStatus.healthy ? `Backend v${backendStatus.version ?? '?'} on port ${backendStatus.port}` : 'Backend unavailable'}
      >
        <Circle
          className={clsx(
            'w-2 h-2',
            backendStatus.healthy ? 'fill-studio-success text-studio-success' : 'fill-studio-error text-studio-error'
          )}
        />
        <span className={clsx('hidden sm:inline', backendStatus.healthy ? 'text-studio-text-muted' : 'text-studio-error')}>
          AI
        </span>
      </div>
    </header>
  );
}
