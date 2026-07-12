import { useEffect, useState } from 'react';
import { Settings, RotateCcw, Save } from 'lucide-react';
import { useAppStore } from '@/stores/app.store';
import { getSettingsSchema, resetSettings } from '@/utils/ipc';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { AppSettings, SettingsFieldSchema } from '@/types';
import { snakeToTitle } from '@/utils/helpers';
import { clsx } from 'clsx';
import * as Switch from '@radix-ui/react-switch';
import * as Tabs from '@radix-ui/react-tabs';

export default function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSetting = useAppStore((s) => s.updateSetting);
  const loadSettings = useAppStore((s) => s.loadSettings);
  const addToast = useAppStore((s) => s.addToast);

  const [schema, setSchema] = useState<Record<string, SettingsFieldSchema>>({});
  const [dirty, setDirty] = useState<Partial<AppSettings>>({});
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    getSettingsSchema().then(setSchema).catch(console.error);
  }, []);

  const groups = Object.entries(schema).reduce<Record<string, Array<[string, SettingsFieldSchema]>>>(
    (acc, [key, field]) => {
      const g = field.group;
      if (!acc[g]) acc[g] = [];
      acc[g].push([key, field]);
      return acc;
    },
    {}
  );

  const getValue = (key: string) => {
    if (key in dirty) return (dirty as Record<string, unknown>)[key];
    return (settings as Record<string, unknown> | null)?.[key];
  };

  const handleChange = (key: string, value: unknown) => {
    setDirty((d) => ({ ...d, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(dirty)) {
        await updateSetting(key as keyof AppSettings, value as AppSettings[keyof AppSettings]);
      }
      setDirty({});
      addToast({ type: 'success', title: 'Settings saved' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetSettings();
      await loadSettings();
      setDirty({});
      addToast({ type: 'info', title: 'Settings reset to defaults' });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-studio-border">
        <Settings className="w-5 h-5 text-studio-accent" />
        <h1 className="text-base font-semibold text-studio-text flex-1">Settings</h1>
        {Object.keys(dirty).length > 0 && (
          <span className="text-xs text-studio-warning">Unsaved changes</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          onClick={handleReset}
          loading={resetting}
        >
          Reset Defaults
        </Button>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Save className="w-3.5 h-3.5" />}
          onClick={handleSave}
          loading={saving}
          disabled={Object.keys(dirty).length === 0}
        >
          Save
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Tabs.Root defaultValue={Object.keys(groups)[0] ?? ''} orientation="vertical" className="flex h-full">
          {/* Group tabs */}
          <Tabs.List className="w-44 flex-shrink-0 border-r border-studio-border py-4 flex flex-col gap-1">
            {Object.keys(groups).map((group) => (
              <Tabs.Trigger
                key={group}
                value={group}
                className={clsx(
                  'text-left px-4 py-2 text-sm transition-colors',
                  'hover:bg-studio-surface hover:text-studio-text',
                  'data-[state=active]:text-studio-accent data-[state=active]:bg-studio-accent/10',
                  'text-studio-text-muted'
                )}
              >
                {group}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {/* Settings fields */}
          {Object.entries(groups).map(([group, fields]) => (
            <Tabs.Content
              key={group}
              value={group}
              className="flex-1 overflow-y-auto p-6"
            >
              <h2 className="text-sm font-semibold text-studio-text mb-4">{group}</h2>
              <div className="flex flex-col gap-5 max-w-lg">
                {fields.map(([key, field]) => (
                  <SettingsField
                    key={key}
                    fieldKey={key}
                    field={field}
                    value={getValue(key)}
                    onChange={(v) => handleChange(key, v)}
                  />
                ))}
              </div>
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </div>
    </div>
  );
}

function SettingsField({
  fieldKey,
  field,
  value,
  onChange,
}: {
  fieldKey: string;
  field: SettingsFieldSchema;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <label className="text-sm font-medium text-studio-text">{field.label}</label>
          {field.description && (
            <p className="text-xs text-studio-text-muted mt-0.5">{field.description}</p>
          )}
        </div>

        <div className="flex-shrink-0">
          {field.type === 'boolean' ? (
            <Switch.Root
              checked={!!value}
              onCheckedChange={onChange}
              className={clsx(
                'w-10 h-5 rounded-full transition-colors',
                value ? 'bg-studio-accent' : 'bg-studio-border'
              )}
            >
              <Switch.Thumb
                className={clsx(
                  'block w-4 h-4 rounded-full bg-white shadow transition-transform',
                  value ? 'translate-x-5' : 'translate-x-0.5'
                )}
              />
            </Switch.Root>
          ) : field.enum ? (
            <select
              value={String(value ?? '')}
              onChange={(e) => onChange(field.type === 'integer' ? Number(e.target.value) : e.target.value)}
              className="h-8 px-2 text-xs rounded bg-studio-bg border border-studio-border text-studio-text focus:outline-none focus:border-studio-accent"
            >
              {field.enum.map((opt) => (
                <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
              ))}
            </select>
          ) : field.type === 'integer' || field.type === 'string' ? (
            <Input
              type={field.type === 'integer' ? 'number' : 'text'}
              value={String(value ?? '')}
              onChange={(e) => onChange(field.type === 'integer' ? Number(e.target.value) : e.target.value)}
              min={field.min}
              max={field.max}
              className="w-40"
            />
          ) : field.type === 'path' ? (
            <Input
              type="text"
              value={String(value ?? '')}
              onChange={(e) => onChange(e.target.value)}
              className="w-64"
              placeholder="Browse or type path..."
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
