import { useEffect, useState } from 'react';
import { Package, Search, Upload, Trash2, ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react';
import { useAppStore } from '@/stores/app.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { Plugin } from '@/types';
import { listPlugins, enablePlugin, disablePlugin, uninstallPlugin } from '@/utils/ipc';
import { clsx } from 'clsx';

export default function PluginManager() {
  const addToast = useAppStore((s) => s.addToast);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmUninstall, setConfirmUninstall] = useState<Plugin | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listPlugins();
      setPlugins(data);
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to load plugins', description: String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = plugins.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = async (plugin: Plugin) => {
    try {
      if (plugin.enabled === 1) {
        await disablePlugin(plugin.id);
        addToast({ type: 'info', title: `${plugin.name} disabled` });
      } else {
        await enablePlugin(plugin.id);
        addToast({ type: 'success', title: `${plugin.name} enabled` });
      }
      await load();
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to toggle plugin', description: String(e) });
    }
  };

  const handleUninstall = async (plugin: Plugin) => {
    try {
      await uninstallPlugin(plugin.id);
      setConfirmUninstall(null);
      await load();
      addToast({ type: 'success', title: `${plugin.name} uninstalled` });
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to uninstall plugin', description: String(e) });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-studio-border">
        <Package className="w-5 h-5 text-studio-accent" />
        <h1 className="text-base font-semibold text-studio-text flex-1">Plugin Manager</h1>
        <div className="w-48">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plugins..."
            leftAddon={<Search className="w-3.5 h-3.5" />}
          />
        </div>
        <Button variant="secondary" size="sm" leftIcon={<Upload className="w-3.5 h-3.5" />}>
          Install from File
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <Package className="w-12 h-12 text-studio-text-muted" />
            <p className="text-studio-text-muted text-sm">
              {search ? 'No plugins match your search' : 'No plugins installed'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((plugin) => (
              <div
                key={plugin.id}
                className={clsx(
                  'flex items-start gap-4 p-4 rounded-lg border',
                  plugin.enabled === 1
                    ? 'bg-studio-surface border-studio-border'
                    : 'bg-studio-bg border-studio-border/60 opacity-60'
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-studio-accent/20 flex items-center justify-center flex-shrink-0 border border-studio-border">
                  <Package className="w-5 h-5 text-studio-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-studio-text">{plugin.name}</h3>
                    <span className="text-[10px] text-studio-text-muted bg-studio-border px-1.5 py-0.5 rounded">
                      v{plugin.version}
                    </span>
                    <span className="text-[10px] text-studio-text-muted">{plugin.author}</span>
                  </div>
                  <p className="text-xs text-studio-text-muted mt-0.5">{plugin.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggle(plugin)}
                    className={clsx(
                      'transition-colors',
                      plugin.enabled === 1 ? 'text-studio-accent' : 'text-studio-text-muted'
                    )}
                    title={plugin.enabled === 1 ? 'Disable plugin' : 'Enable plugin'}
                  >
                    {plugin.enabled === 1
                      ? <ToggleRight className="w-6 h-6" />
                      : <ToggleLeft className="w-6 h-6" />
                    }
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setConfirmUninstall(plugin)}
                    title="Uninstall"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-studio-text-muted hover:text-studio-error" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmUninstall && (
        <Modal
          open
          onClose={() => setConfirmUninstall(null)}
          title="Uninstall Plugin"
          description={`Remove ${confirmUninstall.name}?`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmUninstall(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => handleUninstall(confirmUninstall)}>Uninstall</Button>
            </>
          }
        >
          <p className="text-sm text-studio-text-muted">
            This plugin and all its files will be removed. This action cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
