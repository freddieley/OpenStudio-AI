import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type { AppInfo, AppSettings, BackendStatus, CommandPaletteEntry, SystemInfo, Toast } from '@/types';
import { getAppInfo, getBackendStatus, getSettings, getSystemInfo, updateSettings } from '@/utils/ipc';
import { generateId } from '@/utils/helpers';

interface AppStore {
  // Application info
  appInfo: AppInfo | null;
  systemInfo: SystemInfo | null;
  backendStatus: BackendStatus;

  // Settings
  settings: AppSettings | null;
  settingsLoading: boolean;

  // Global UI state
  toasts: Toast[];
  commandPaletteOpen: boolean;
  commandPaletteQuery: string;
  commandPaletteEntries: CommandPaletteEntry[];

  // Active panel / current view
  activePanel: string;

  // Sidebar state
  sidebarCollapsed: boolean;
  sidebarWidth: number;

  // Actions
  initialize: () => Promise<void>;
  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  setCommandPaletteQuery: (query: string) => void;
  registerCommands: (entries: CommandPaletteEntry[]) => void;
  setActivePanel: (panel: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  refreshBackendStatus: () => Promise<void>;
}

export const useAppStore = create<AppStore>()(
  immer(
    persist(
      (set, get) => ({
        appInfo: null,
        systemInfo: null,
        backendStatus: { running: false, healthy: false },
        settings: null,
        settingsLoading: false,
        toasts: [],
        commandPaletteOpen: false,
        commandPaletteQuery: '',
        commandPaletteEntries: [],
        activePanel: 'dashboard',
        sidebarCollapsed: false,
        sidebarWidth: 240,

        initialize: async () => {
          try {
            const [appInfo, systemInfo] = await Promise.all([
              getAppInfo(),
              getSystemInfo(),
            ]);
            set((state) => {
              state.appInfo = appInfo;
              state.systemInfo = systemInfo;
            });
            await get().loadSettings();
            // Start polling backend status
            const pollStatus = async () => {
              await get().refreshBackendStatus();
              setTimeout(pollStatus, 5000);
            };
            pollStatus();
          } catch (error) {
            console.error('Failed to initialize app:', error);
          }
        },

        loadSettings: async () => {
          set((state) => { state.settingsLoading = true; });
          try {
            const settings = await getSettings();
            set((state) => {
              state.settings = settings;
              state.settingsLoading = false;
            });
          } catch (error) {
            set((state) => { state.settingsLoading = false; });
            get().addToast({
              type: 'error',
              title: 'Failed to load settings',
              description: String(error),
            });
          }
        },

        updateSetting: async (key, value) => {
          const prevSettings = get().settings;
          // Optimistic update
          set((state) => {
            if (state.settings) {
              (state.settings as Record<string, unknown>)[key as string] = value;
            }
          });
          try {
            const updated = await updateSettings({ [key]: value } as Partial<AppSettings>);
            set((state) => { state.settings = updated; });
          } catch (error) {
            // Rollback
            set((state) => { state.settings = prevSettings; });
            get().addToast({
              type: 'error',
              title: 'Failed to save setting',
              description: String(error),
            });
          }
        },

        addToast: (toast) => {
          const id = generateId();
          const duration = toast.duration ?? 5000;
          set((state) => {
            state.toasts.push({ ...toast, id });
          });
          if (duration > 0) {
            setTimeout(() => get().removeToast(id), duration);
          }
        },

        removeToast: (id) => {
          set((state) => {
            state.toasts = state.toasts.filter((t) => t.id !== id);
          });
        },

        openCommandPalette: () => {
          set((state) => {
            state.commandPaletteOpen = true;
            state.commandPaletteQuery = '';
          });
        },

        closeCommandPalette: () => {
          set((state) => {
            state.commandPaletteOpen = false;
            state.commandPaletteQuery = '';
          });
        },

        setCommandPaletteQuery: (query) => {
          set((state) => { state.commandPaletteQuery = query; });
        },

        registerCommands: (entries) => {
          set((state) => {
            const existingIds = new Set(state.commandPaletteEntries.map((e) => e.id));
            for (const entry of entries) {
              if (!existingIds.has(entry.id)) {
                state.commandPaletteEntries.push(entry);
              }
            }
          });
        },

        setActivePanel: (panel) => {
          set((state) => { state.activePanel = panel; });
        },

        setSidebarCollapsed: (collapsed) => {
          set((state) => { state.sidebarCollapsed = collapsed; });
        },

        setSidebarWidth: (width) => {
          set((state) => { state.sidebarWidth = Math.max(180, Math.min(400, width)); });
        },

        refreshBackendStatus: async () => {
          try {
            const status = await getBackendStatus();
            set((state) => { state.backendStatus = status; });
          } catch {
            set((state) => {
              state.backendStatus = { running: false, healthy: false };
            });
          }
        },
      }),
      {
        name: 'openstudio-app-store',
        partialize: (state) => ({
          activePanel: state.activePanel,
          sidebarCollapsed: state.sidebarCollapsed,
          sidebarWidth: state.sidebarWidth,
        }),
      }
    )
  )
);
