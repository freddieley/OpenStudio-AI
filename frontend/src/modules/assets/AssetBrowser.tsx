import { Package, FolderOpen, Image, Film, AudioWaveform } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/project.store';
import { listAssets, importAsset } from '@/utils/ipc';
import type { Asset } from '@/types';
import { Button } from '@/components/ui/Button';
import { formatBytes } from '@/utils/helpers';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useAppStore } from '@/stores/app.store';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  image: Image,
  video: Film,
  audio: AudioWaveform,
  model: Package,
  file: FolderOpen,
};

export default function AssetBrowser() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const addToast = useAppStore((s) => s.addToast);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    try {
      const data = await listAssets({ projectId: activeProject?.id });
      setAssets(data);
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to load assets', description: String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeProject?.id]);

  const handleImport = async () => {
    const selected = await openDialog({ multiple: true, title: 'Import Assets' });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    for (const path of paths) {
      try {
        await importAsset({ path, projectId: activeProject?.id });
      } catch (e) {
        addToast({ type: 'error', title: 'Failed to import asset', description: String(e) });
      }
    }
    await load();
    addToast({ type: 'success', title: `Imported ${paths.length} asset(s)` });
  };

  const filtered = filter === 'all' ? assets : assets.filter((a) => a.type === filter);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-studio-border">
        <Package className="w-5 h-5 text-studio-accent" />
        <h1 className="text-base font-semibold text-studio-text flex-1">Asset Browser</h1>
        <div className="flex gap-1">
          {['all', 'image', 'video', 'audio', 'model'].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-2 py-1 text-xs rounded capitalize transition-colors ${
                filter === t ? 'bg-studio-accent text-white' : 'text-studio-text-muted hover:bg-studio-surface'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <Button variant="primary" size="sm" onClick={handleImport}>Import</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <Package className="w-12 h-12 text-studio-text-muted opacity-30" />
            <p className="text-studio-text-muted text-sm">No assets found</p>
            <Button variant="secondary" size="sm" onClick={handleImport}>Import Assets</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {filtered.map((asset) => {
              const Icon = TYPE_ICONS[asset.type] ?? FolderOpen;
              return (
                <div
                  key={asset.id}
                  className="flex flex-col gap-1 rounded-lg overflow-hidden border border-studio-border bg-studio-surface hover:border-studio-accent/40 transition-all cursor-pointer"
                  title={asset.name}
                >
                  <div className="aspect-square bg-studio-bg flex items-center justify-center">
                    {asset.thumbnail_path ? (
                      <img
                        src={`asset://localhost/${asset.thumbnail_path}`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Icon className="w-8 h-8 text-studio-text-muted opacity-40" />
                    )}
                  </div>
                  <div className="px-1.5 pb-1.5">
                    <div className="text-[10px] text-studio-text truncate">{asset.name}</div>
                    <div className="text-[10px] text-studio-text-muted">{formatBytes(asset.size_bytes)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
