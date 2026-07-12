import { useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  FolderOpen,
  Cpu,
  GitBranch,
  Image,
  Film,
  Mic,
  AudioWaveform,
  Layers,
  Package,
  Settings,
  Clock,
  Puzzle,
  Download,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useJobStore } from '@/stores/job.store';
import { useProjectStore } from '@/stores/project.store';
import { useState } from 'react';

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  group?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, group: 'Studio' },
  { id: 'projects', label: 'Projects', path: '/projects', icon: FolderOpen, group: 'Studio' },
  { id: 'assets', label: 'Assets', path: '/assets', icon: Package, group: 'Studio' },
  { id: 'timeline', label: 'Timeline', path: '/timeline', icon: Layers, group: 'Studio' },
  { id: 'image', label: 'Image Gen', path: '/image', icon: Image, group: 'AI Tools' },
  { id: 'video', label: 'Video Studio', path: '/video', icon: Film, group: 'AI Tools' },
  { id: 'voice', label: 'Voice Studio', path: '/voice', icon: AudioWaveform, group: 'AI Tools' },
  { id: 'workflows', label: 'Workflows', path: '/workflows', icon: GitBranch, group: 'AI Tools' },
  { id: 'models', label: 'Models', path: '/models', icon: Cpu, group: 'Management' },
  { id: 'plugins', label: 'Plugins', path: '/plugins', icon: Puzzle, group: 'Management' },
  { id: 'jobs', label: 'Job Queue', path: '/jobs', icon: Clock, group: 'Management' },
  { id: 'export', label: 'Export', path: '/export', icon: Download, group: 'Management' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: Settings, group: 'System' },
];

const GROUPS = ['Studio', 'AI Tools', 'Management', 'System'];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeJobs = useJobStore((s) => s.getActiveJobs());
  const activeProject = useProjectStore((s) => s.activeProject);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const getBadge = (id: string): number | undefined => {
    if (id === 'jobs') return activeJobs.length > 0 ? activeJobs.length : undefined;
    return undefined;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-studio-panel border-r border-studio-border">
      {/* Project indicator */}
      {activeProject && (
        <div className="px-3 py-2 border-b border-studio-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-studio-accent flex-shrink-0" />
            <span className="text-xs text-studio-text truncate">{activeProject.name}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group);
          const isCollapsed = collapsedGroups.has(group);

          return (
            <div key={group} className="mb-1">
              <button
                onClick={() => toggleGroup(group)}
                className="flex items-center gap-1 w-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-studio-text-muted hover:text-studio-text transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                {group}
              </button>

              {!isCollapsed && (
                <div>
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname.startsWith(item.path);
                    const badge = getBadge(item.id);

                    return (
                      <button
                        key={item.id}
                        onClick={() => navigate(item.path)}
                        className={clsx(
                          'flex items-center gap-2.5 w-full px-3 py-1.5 text-sm rounded-sm mx-1 transition-colors',
                          'hover:bg-studio-surface hover:text-studio-text',
                          isActive
                            ? 'bg-studio-accent/15 text-studio-accent-light font-medium'
                            : 'text-studio-text-muted'
                        )}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {badge !== undefined && (
                          <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-studio-accent text-white text-[10px] font-bold flex items-center justify-center px-1">
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
