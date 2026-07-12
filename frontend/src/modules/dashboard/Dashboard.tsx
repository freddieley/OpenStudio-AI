import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Image,
  Film,
  AudioWaveform,
  GitBranch,
  Cpu,
  FolderOpen,
  Activity,
  Clock,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { useAppStore } from '@/stores/app.store';
import { useProjectStore } from '@/stores/project.store';
import { useJobStore } from '@/stores/job.store';
import { useModelStore } from '@/stores/model.store';
import { Button } from '@/components/ui/Button';
import { formatDate, formatDuration } from '@/utils/helpers';

const QUICK_ACTIONS = [
  { label: 'Generate Image', path: '/image', icon: Image, color: 'text-purple-400' },
  { label: 'Create Video', path: '/video', icon: Film, color: 'text-blue-400' },
  { label: 'Voice Studio', path: '/voice', icon: AudioWaveform, color: 'text-green-400' },
  { label: 'New Workflow', path: '/workflows', icon: GitBranch, color: 'text-yellow-400' },
  { label: 'Manage Models', path: '/models', icon: Cpu, color: 'text-red-400' },
  { label: 'Open Project', path: '/projects', icon: FolderOpen, color: 'text-cyan-400' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const appInfo = useAppStore((s) => s.appInfo);
  const systemInfo = useAppStore((s) => s.systemInfo);
  const backendStatus = useAppStore((s) => s.backendStatus);
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const jobs = useJobStore((s) => s.jobs);
  const models = useModelStore((s) => s.models);
  const loadModels = useModelStore((s) => s.loadModels);

  useEffect(() => {
    loadProjects();
    loadModels();
  }, [loadProjects, loadModels]);

  const recentProjects = projects.slice(0, 4);
  const recentJobs = jobs.slice(0, 8);
  const installedModels = models.filter((m) => m.installed === 1);
  const gpu = systemInfo?.gpu_info[0];

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-studio-text">
          Welcome to <span className="text-studio-accent">OpenStudio AI</span>
        </h1>
        <p className="text-studio-text-muted mt-1">
          {appInfo?.version && `v${appInfo.version} · `}
          {backendStatus.healthy ? (
            <span className="text-studio-success">AI backend ready</span>
          ) : (
            <span className="text-studio-error">AI backend offline — some features unavailable</span>
          )}
        </p>
      </div>

      {/* System status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard
          icon={<Cpu className="w-4 h-4" />}
          label="GPU"
          value={gpu ? gpu.name.replace('NVIDIA GeForce ', '').replace('AMD Radeon ', '') : 'No GPU'}
          sub={gpu ? `${Math.round(gpu.vram_mb / 1024)}GB VRAM` : 'CPU mode'}
          color="text-purple-400"
        />
        <StatCard
          icon={<Zap className="w-4 h-4" />}
          label="Installed Models"
          value={String(installedModels.length)}
          sub={`of ${models.length} available`}
          color="text-yellow-400"
        />
        <StatCard
          icon={<Activity className="w-4 h-4" />}
          label="Active Jobs"
          value={String(jobs.filter((j) => j.status === 'running').length)}
          sub={`${jobs.filter((j) => j.status === 'queued').length} queued`}
          color="text-green-400"
        />
        <StatCard
          icon={<FolderOpen className="w-4 h-4" />}
          label="Projects"
          value={String(projects.length)}
          sub="local projects"
          color="text-blue-400"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="xl:col-span-1">
          <SectionHeader title="Quick Actions" />
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.path}
                  onClick={() => navigate(action.path)}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg bg-studio-surface border border-studio-border hover:border-studio-accent/50 hover:bg-studio-surface/80 transition-all text-center group"
                >
                  <Icon className={`w-6 h-6 ${action.color} group-hover:scale-110 transition-transform`} />
                  <span className="text-xs text-studio-text-muted group-hover:text-studio-text transition-colors">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Projects */}
        <div className="xl:col-span-1">
          <SectionHeader
            title="Recent Projects"
            action={<Button variant="ghost" size="xs" onClick={() => navigate('/projects')} rightIcon={<ArrowRight className="w-3 h-3" />}>All</Button>}
          />
          {recentProjects.length === 0 ? (
            <EmptyState
              message="No projects yet"
              action={<Button size="sm" onClick={() => navigate('/projects')}>Create Project</Button>}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {recentProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => navigate('/projects')}
                  className="flex items-center gap-3 p-3 rounded-lg bg-studio-surface border border-studio-border hover:border-studio-border/80 hover:bg-studio-surface/70 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded bg-studio-accent/20 flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="w-5 h-5 text-studio-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-studio-text truncate">{project.name}</div>
                    <div className="text-xs text-studio-text-muted">{formatDate(project.updated_at)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent Jobs */}
        <div className="xl:col-span-1">
          <SectionHeader
            title="Recent Jobs"
            action={<Button variant="ghost" size="xs" onClick={() => navigate('/jobs')} rightIcon={<ArrowRight className="w-3 h-3" />}>All</Button>}
          />
          {recentJobs.length === 0 ? (
            <EmptyState message="No jobs yet" />
          ) : (
            <div className="flex flex-col gap-1.5">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-2 px-3 py-2 rounded bg-studio-surface border border-studio-border"
                >
                  <StatusDot status={job.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-studio-text truncate capitalize">{job.type.replace(/-/g, ' ')}</div>
                    <div className="text-[10px] text-studio-text-muted">{formatDate(job.created_at)}</div>
                  </div>
                  {job.status === 'running' && (
                    <span className="text-[10px] text-studio-accent">{Math.round(job.progress * 100)}%</span>
                  )}
                  {job.duration_ms != null && (
                    <span className="text-[10px] text-studio-text-muted">{formatDuration(job.duration_ms)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-lg bg-studio-surface border border-studio-border">
      <div className={`flex items-center gap-2 text-sm ${color}`}>
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      <div className="text-xl font-bold text-studio-text truncate">{value}</div>
      <div className="text-xs text-studio-text-muted">{sub}</div>
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-studio-text">{title}</h2>
      {action}
    </div>
  );
}

function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 rounded-lg bg-studio-surface border border-dashed border-studio-border">
      <span className="text-sm text-studio-text-muted">{message}</span>
      {action}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-studio-accent animate-pulse',
    completed: 'bg-studio-success',
    failed: 'bg-studio-error',
    queued: 'bg-studio-warning',
    cancelled: 'bg-studio-text-muted',
    paused: 'bg-studio-text-muted',
  };
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[status] ?? 'bg-studio-muted'}`} />;
}
