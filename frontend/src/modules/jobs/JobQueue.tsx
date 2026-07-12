import { useEffect } from 'react';
import { Clock, X, Trash2, RefreshCw, CheckCircle2, AlertCircle, Pause, Play } from 'lucide-react';
import { useJobStore } from '@/stores/job.store';
import { Button } from '@/components/ui/Button';
import { formatDate, formatDuration } from '@/utils/helpers';
import type { Job } from '@/types';
import { clsx } from 'clsx';
import * as Progress from '@radix-ui/react-progress';

const STATUS_ICONS = {
  running: <span className="w-3 h-3 rounded-full bg-studio-accent animate-pulse" />,
  queued: <span className="w-3 h-3 rounded-full bg-studio-warning" />,
  completed: <CheckCircle2 className="w-3.5 h-3.5 text-studio-success" />,
  failed: <AlertCircle className="w-3.5 h-3.5 text-studio-error" />,
  cancelled: <span className="w-3 h-3 rounded-full bg-studio-text-muted" />,
  paused: <Pause className="w-3.5 h-3.5 text-studio-text-muted" />,
};

const STATUS_LABELS: Record<string, string> = {
  running: 'Running',
  queued: 'Queued',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  paused: 'Paused',
};

export default function JobQueue() {
  const { jobs, loading, loadJobs, cancelJob, clearCompleted } = useJobStore();

  useEffect(() => {
    loadJobs({ limit: 200 });
  }, [loadJobs]);

  const groups = {
    active: jobs.filter((j) => j.status === 'running' || j.status === 'queued'),
    completed: jobs.filter((j) => j.status === 'completed'),
    failed: jobs.filter((j) => j.status === 'failed' || j.status === 'cancelled'),
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-studio-border">
        <Clock className="w-5 h-5 text-studio-accent" />
        <h1 className="text-base font-semibold text-studio-text flex-1">Job Queue</h1>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={() => loadJobs({ limit: 200 })}
          loading={loading}
        >
          Refresh
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={() => clearCompleted()}
          disabled={groups.completed.length === 0 && groups.failed.length === 0}
        >
          Clear Finished
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Active jobs */}
        <Section title="Active" count={groups.active.length}>
          {groups.active.length === 0 ? (
            <EmptySection message="No active jobs" />
          ) : (
            groups.active.map((job) => <JobRow key={job.id} job={job} onCancel={() => cancelJob(job.id)} />)
          )}
        </Section>

        {/* Completed */}
        <Section title="Completed" count={groups.completed.length}>
          {groups.completed.length === 0 ? (
            <EmptySection message="No completed jobs" />
          ) : (
            groups.completed.map((job) => <JobRow key={job.id} job={job} />)
          )}
        </Section>

        {/* Failed / Cancelled */}
        <Section title="Failed / Cancelled" count={groups.failed.length}>
          {groups.failed.length === 0 ? (
            <EmptySection message="No failed jobs" />
          ) : (
            groups.failed.map((job) => <JobRow key={job.id} job={job} />)
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-studio-text">{title}</h2>
        <span className="text-xs text-studio-text-muted bg-studio-surface border border-studio-border px-1.5 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="py-6 text-center text-sm text-studio-text-muted bg-studio-surface border border-dashed border-studio-border rounded-lg">
      {message}
    </div>
  );
}

function JobRow({ job, onCancel }: { job: Job; onCancel?: () => void }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-studio-surface border border-studio-border">
      <div className="flex-shrink-0">{STATUS_ICONS[job.status] ?? <span className="w-3 h-3 rounded-full bg-studio-muted" />}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-studio-text capitalize">{job.type.replace(/-/g, ' ')}</span>
          <span className={clsx(
            'text-[10px] px-1.5 py-0.5 rounded border',
            job.status === 'running' ? 'text-studio-accent border-studio-accent/30 bg-studio-accent/10' :
            job.status === 'completed' ? 'text-studio-success border-studio-success/30 bg-studio-success/10' :
            job.status === 'failed' ? 'text-studio-error border-studio-error/30 bg-studio-error/10' :
            'text-studio-text-muted border-studio-border'
          )}>
            {STATUS_LABELS[job.status] ?? job.status}
          </span>
        </div>

        {job.status === 'running' && (
          <Progress.Root className="h-1 rounded-full bg-studio-border overflow-hidden mt-1.5 w-48">
            <Progress.Indicator
              className="h-full bg-studio-accent transition-all"
              style={{ width: `${job.progress * 100}%` }}
            />
          </Progress.Root>
        )}

        {job.error && (
          <p className="text-xs text-studio-error mt-0.5 truncate">{job.error}</p>
        )}
      </div>

      <div className="text-xs text-studio-text-muted flex-shrink-0 text-right">
        <div>{formatDate(job.created_at)}</div>
        {job.duration_ms != null && <div>{formatDuration(job.duration_ms)}</div>}
        {job.status === 'running' && (
          <div className="text-studio-accent">{Math.round(job.progress * 100)}%</div>
        )}
      </div>

      {onCancel && (
        <Button variant="ghost" size="icon-sm" onClick={onCancel} title="Cancel job">
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
