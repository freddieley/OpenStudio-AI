import { useEffect, useState, useCallback } from 'react';
import {
  Cpu, Search, Download, Trash2, RefreshCw, Check, X,
  ChevronDown, Filter, SortAsc, HardDrive, Zap,
} from 'lucide-react';
import { useModelStore } from '@/stores/model.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { formatBytes } from '@/utils/helpers';
import type { Model, ModelType } from '@/types';
import * as Select from '@radix-ui/react-select';
import * as Progress from '@radix-ui/react-progress';
import { clsx } from 'clsx';

const MODEL_TYPE_LABELS: Record<string, string> = {
  'image-generation': 'Image Gen',
  'video-generation': 'Video Gen',
  'speech-recognition': 'Speech Recognition',
  tts: 'Text-to-Speech',
  'voice-cloning': 'Voice Cloning',
  'lip-sync': 'Lip Sync',
  upscaling: 'Upscaling',
  'background-removal': 'BG Removal',
  'caption-generation': 'Captions',
  llm: 'LLM',
  lora: 'LoRA',
  vae: 'VAE',
  controlnet: 'ControlNet',
  embedding: 'Embedding',
  other: 'Other',
};

const TYPE_COLORS: Record<string, string> = {
  'image-generation': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  'video-generation': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  llm: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  'speech-recognition': 'text-green-400 bg-green-400/10 border-green-400/20',
  tts: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  upscaling: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
};

export default function ModelManager() {
  const {
    models, loading, installProgress, activeInstalls,
    loadModels, installModel, uninstallModel, cancelInstall, refreshRegistry,
  } = useModelStore();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterInstalled, setFilterInstalled] = useState<'all' | 'installed' | 'not-installed'>('all');
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState<Model | null>(null);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const filtered = models.filter((m) => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.description.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (filterType !== 'all' && m.type !== filterType) return false;
    if (filterInstalled === 'installed' && m.installed !== 1) return false;
    if (filterInstalled === 'not-installed' && m.installed !== 0) return false;
    return true;
  });

  const modelTypes = Array.from(new Set(models.map((m) => m.type)));

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-studio-border flex-wrap gap-y-2">
        <Cpu className="w-5 h-5 text-studio-accent" />
        <h1 className="text-base font-semibold text-studio-text">Model Manager</h1>
        <div className="flex-1" />
        <div className="w-48">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models..."
            leftAddon={<Search className="w-3.5 h-3.5" />}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-8 px-2 text-xs rounded bg-studio-bg border border-studio-border text-studio-text focus:outline-none focus:border-studio-accent"
        >
          <option value="all">All Types</option>
          {modelTypes.map((t) => (
            <option key={t} value={t}>{MODEL_TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>
        <select
          value={filterInstalled}
          onChange={(e) => setFilterInstalled(e.target.value as typeof filterInstalled)}
          className="h-8 px-2 text-xs rounded bg-studio-bg border border-studio-border text-studio-text focus:outline-none focus:border-studio-accent"
        >
          <option value="all">All</option>
          <option value="installed">Installed</option>
          <option value="not-installed">Not Installed</option>
        </select>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={() => refreshRegistry()}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 px-6 py-2 border-b border-studio-border text-xs text-studio-text-muted">
        <span>{models.filter((m) => m.installed === 1).length} installed</span>
        <span>{models.length} total</span>
        <span>{activeInstalls.size} downloading</span>
      </div>

      {/* Model grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && models.length === 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 rounded-lg shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <Cpu className="w-12 h-12 text-studio-text-muted" />
            <p className="text-studio-text-muted text-sm">No models found</p>
            <Button variant="secondary" size="sm" onClick={() => refreshRegistry()}>
              Refresh Registry
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((model) => {
              const jobId = activeInstalls.get(model.id);
              const progress = jobId ? installProgress.get(jobId) : undefined;
              const typeColor = TYPE_COLORS[model.type] ?? 'text-studio-text-muted bg-studio-muted border-studio-border';

              return (
                <div
                  key={model.id}
                  className="flex flex-col gap-3 p-4 rounded-lg bg-studio-surface border border-studio-border hover:border-studio-border/80 transition-all cursor-pointer"
                  onClick={() => setSelectedModel(model)}
                >
                  {/* Header row */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-studio-bg flex items-center justify-center flex-shrink-0 border border-studio-border">
                      {model.thumbnail ? (
                        <img src={model.thumbnail} alt="" className="w-full h-full rounded-lg object-cover" />
                      ) : (
                        <Cpu className="w-5 h-5 text-studio-text-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-studio-text truncate">{model.name}</h3>
                        {model.installed === 1 && (
                          <Check className="w-3.5 h-3.5 text-studio-success flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded border', typeColor)}>
                          {MODEL_TYPE_LABELS[model.type] ?? model.type}
                        </span>
                        <span className="text-[10px] text-studio-text-muted">{model.variant}</span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {model.description && (
                    <p className="text-xs text-studio-text-muted line-clamp-2">{model.description}</p>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-[10px] text-studio-text-muted">
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3 h-3" />
                      {formatBytes(model.size_bytes)}
                    </span>
                    {model.vram_mb > 0 && (
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {model.vram_mb >= 1024 ? `${Math.round(model.vram_mb / 1024)}GB` : `${model.vram_mb}MB`} VRAM
                      </span>
                    )}
                    {model.license && (
                      <span className="truncate">{model.license}</span>
                    )}
                  </div>

                  {/* Download progress */}
                  {progress && (progress.status === 'running' || progress.status === 'queued') && (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-studio-text-muted capitalize">{progress.status}</span>
                        <span className="text-studio-accent">{Math.round(progress.progress * 100)}%</span>
                      </div>
                      <Progress.Root className="h-1 rounded-full bg-studio-border overflow-hidden">
                        <Progress.Indicator
                          className="h-full bg-studio-accent transition-all"
                          style={{ width: `${progress.progress * 100}%` }}
                        />
                      </Progress.Root>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto" onClick={(e) => e.stopPropagation()}>
                    {model.installed === 0 && !progress ? (
                      <Button
                        variant="primary"
                        size="xs"
                        leftIcon={<Download className="w-3 h-3" />}
                        onClick={() => installModel(model.id)}
                        className="flex-1"
                      >
                        Install
                      </Button>
                    ) : model.installed === 1 ? (
                      <Button
                        variant="danger"
                        size="xs"
                        leftIcon={<Trash2 className="w-3 h-3" />}
                        onClick={() => setConfirmUninstall(model)}
                        className="flex-1"
                      >
                        Uninstall
                      </Button>
                    ) : progress ? (
                      <Button
                        variant="secondary"
                        size="xs"
                        leftIcon={<X className="w-3 h-3" />}
                        onClick={() => cancelInstall(activeInstalls.get(model.id)!)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Model Detail Modal */}
      {selectedModel && (
        <Modal
          open
          onClose={() => setSelectedModel(null)}
          title={selectedModel.name}
          description={`${MODEL_TYPE_LABELS[selectedModel.type] ?? selectedModel.type} · ${selectedModel.author}`}
          size="lg"
          footer={
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setSelectedModel(null)}>Close</Button>
              {selectedModel.installed === 0 ? (
                <Button
                  variant="primary"
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={() => { installModel(selectedModel.id); setSelectedModel(null); }}
                >
                  Install Model
                </Button>
              ) : (
                <Button
                  variant="danger"
                  leftIcon={<Trash2 className="w-4 h-4" />}
                  onClick={() => { setConfirmUninstall(selectedModel); setSelectedModel(null); }}
                >
                  Uninstall
                </Button>
              )}
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-studio-text-muted">{selectedModel.description}</p>
            <div className="grid grid-cols-2 gap-3">
              <DetailRow label="Type" value={MODEL_TYPE_LABELS[selectedModel.type] ?? selectedModel.type} />
              <DetailRow label="Variant" value={selectedModel.variant} />
              <DetailRow label="Version" value={selectedModel.version} />
              <DetailRow label="Author" value={selectedModel.author} />
              <DetailRow label="License" value={selectedModel.license} />
              <DetailRow label="Size" value={formatBytes(selectedModel.size_bytes)} />
              <DetailRow label="VRAM Required" value={selectedModel.vram_mb > 0 ? `${selectedModel.vram_mb}MB` : 'Unknown'} />
              <DetailRow label="Status" value={selectedModel.installed === 1 ? 'Installed' : 'Not Installed'} />
            </div>
            {selectedModel.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedModel.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-studio-bg border border-studio-border text-studio-text-muted">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Confirm uninstall */}
      {confirmUninstall && (
        <Modal
          open
          onClose={() => setConfirmUninstall(null)}
          title="Uninstall Model"
          description={`Remove ${confirmUninstall.name} from your system?`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmUninstall(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => { uninstallModel(confirmUninstall.id); setConfirmUninstall(null); }}
              >
                Uninstall
              </Button>
            </>
          }
        >
          <p className="text-sm text-studio-text-muted">
            This will delete the model files from disk. You can re-install it later from the registry.
          </p>
        </Modal>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-studio-text-muted uppercase tracking-wider">{label}</span>
      <span className="text-sm text-studio-text">{value || '—'}</span>
    </div>
  );
}
