import { useEffect, useRef, useState, useMemo } from 'react';
import { Command } from 'cmdk';
import { Search, ArrowRight } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAppStore } from '@/stores/app.store';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';

// Built-in navigation commands
const NAV_COMMANDS = [
  { id: 'nav-dashboard', label: 'Go to Dashboard', path: '/dashboard', category: 'Navigate' },
  { id: 'nav-projects', label: 'Go to Projects', path: '/projects', category: 'Navigate' },
  { id: 'nav-models', label: 'Go to Model Manager', path: '/models', category: 'Navigate' },
  { id: 'nav-workflows', label: 'Go to Workflow Editor', path: '/workflows', category: 'Navigate' },
  { id: 'nav-image', label: 'Go to Image Generator', path: '/image', category: 'Navigate' },
  { id: 'nav-video', label: 'Go to Video Studio', path: '/video', category: 'Navigate' },
  { id: 'nav-voice', label: 'Go to Voice Studio', path: '/voice', category: 'Navigate' },
  { id: 'nav-timeline', label: 'Go to Timeline', path: '/timeline', category: 'Navigate' },
  { id: 'nav-assets', label: 'Go to Asset Browser', path: '/assets', category: 'Navigate' },
  { id: 'nav-jobs', label: 'Go to Job Queue', path: '/jobs', category: 'Navigate' },
  { id: 'nav-plugins', label: 'Go to Plugin Manager', path: '/plugins', category: 'Navigate' },
  { id: 'nav-settings', label: 'Go to Settings', path: '/settings', category: 'Navigate' },
  { id: 'nav-export', label: 'Go to Export Manager', path: '/export', category: 'Navigate' },
];

export function CommandPalette() {
  const open = useAppStore((s) => s.commandPaletteOpen);
  const closeCommandPalette = useAppStore((s) => s.closeCommandPalette);
  const registeredCommands = useAppStore((s) => s.commandPaletteEntries);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const allCommands = useMemo(() => {
    const navCmds = NAV_COMMANDS.map((c) => ({
      id: c.id,
      label: c.label,
      category: c.category,
      action: () => { navigate(c.path); closeCommandPalette(); },
    }));
    const userCmds = registeredCommands.map((c) => ({
      id: c.id,
      label: c.label,
      category: c.category ?? 'Commands',
      action: async () => { await c.action(); closeCommandPalette(); },
    }));
    return [...navCmds, ...userCmds];
  }, [registeredCommands, navigate, closeCommandPalette]);

  const categories = useMemo(() => {
    const cats = new Set(allCommands.map((c) => c.category));
    return Array.from(cats);
  }, [allCommands]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && closeCommandPalette()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 animate-fade-in" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4"
          aria-label="Command Palette"
        >
          <div className="w-full max-w-xl bg-studio-surface border border-studio-border rounded-xl shadow-modal overflow-hidden animate-scale-in">
            <Command shouldFilter loop className="flex flex-col">
              {/* Search input */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-studio-border">
                <Search className="w-4 h-4 text-studio-text-muted flex-shrink-0" />
                <Command.Input
                  ref={inputRef}
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search commands..."
                  className="flex-1 bg-transparent text-studio-text placeholder:text-studio-text-muted outline-none text-sm"
                />
                <kbd className="text-[10px] font-mono text-studio-text-muted bg-studio-border px-1.5 py-0.5 rounded">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <Command.List className="max-h-[360px] overflow-y-auto py-2">
                <Command.Empty className="px-4 py-8 text-center text-sm text-studio-text-muted">
                  No commands found
                </Command.Empty>

                {categories.map((category) => {
                  const cmds = allCommands.filter((c) => c.category === category);
                  return (
                    <Command.Group key={category} heading={category}
                      className="[&>*[cmdk-group-heading]]:px-3 [&>*[cmdk-group-heading]]:py-1.5 [&>*[cmdk-group-heading]]:text-[10px] [&>*[cmdk-group-heading]]:font-semibold [&>*[cmdk-group-heading]]:uppercase [&>*[cmdk-group-heading]]:tracking-widest [&>*[cmdk-group-heading]]:text-studio-text-muted"
                    >
                      {cmds.map((cmd) => (
                        <Command.Item
                          key={cmd.id}
                          value={`${cmd.category} ${cmd.label}`}
                          onSelect={() => cmd.action()}
                          className={clsx(
                            'flex items-center gap-3 px-3 py-2 mx-1 rounded cursor-pointer text-sm',
                            'text-studio-text-muted hover:text-studio-text',
                            'data-[selected=true]:bg-studio-accent/15 data-[selected=true]:text-studio-accent-light',
                            'transition-colors'
                          )}
                        >
                          <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{cmd.label}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}
              </Command.List>
            </Command>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
