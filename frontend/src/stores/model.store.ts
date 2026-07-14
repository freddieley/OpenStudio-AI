import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Model, ModelInstallProgress } from '@/types';
import {
  cancelModelInstall,
  getModelInstallProgress,
  installModel,
  listModels,
  refreshModelRegistry,
  uninstallModel,
} from '@/utils/ipc';
import { useAppStore } from './app.store';

interface ModelStore {
  models: Model[];
  loading: boolean;
  error: string | null;
  installProgress: Map<string, ModelInstallProgress>; // jobId -> progress
  activeInstalls: Map<string, string>; // modelId -> jobId

  // Actions
  loadModels: (params?: { modelType?: string; installedOnly?: boolean }) => Promise<void>;
  installModel: (id: string, installPath?: string) => Promise<string>;
  uninstallModel: (id: string) => Promise<void>;
  cancelInstall: (jobId: string) => Promise<void>;
  pollInstallProgress: (jobId: string) => void;
  refreshRegistry: () => Promise<void>;
  getInstalledModels: (type?: string) => Model[];
}

export const useModelStore = create<ModelStore>()(
  immer((set, get) => ({
    models: [],
    loading: false,
    error: null,
    installProgress: new Map(),
    activeInstalls: new Map(),

    loadModels: async (params) => {
      set((state) => { state.loading = true; state.error = null; });
      try {
        const models = await listModels(params);
        set((state) => { state.models = models; state.loading = false; });
      } catch (error) {
        const msg = String(error);
        set((state) => { state.loading = false; state.error = msg; });
        useAppStore.getState().addToast({ type: 'error', title: 'Failed to load models', description: msg });
      }
    },

    installModel: async (id, installPath) => {
      try {
        const jobId = await installModel(id, installPath);
        set((state) => {
          state.activeInstalls.set(id, jobId);
          state.installProgress.set(jobId, {
            job_id: jobId,
            model_id: id,
            status: 'queued',
            progress: 0,
            downloaded_bytes: 0,
            total_bytes: 0,
          });
        });
        get().pollInstallProgress(jobId);
        return jobId;
      } catch (error) {
        const msg = String(error);
        useAppStore.getState().addToast({ type: 'error', title: 'Failed to start model install', description: msg });
        throw error;
      }
    },

    uninstallModel: async (id) => {
      try {
        await uninstallModel(id);
        set((state) => {
          const idx = state.models.findIndex((m) => m.id === id);
          if (idx !== -1 && state.models[idx]) {
            state.models[idx]!.installed = 0;
            state.models[idx]!.install_path = undefined;
          }
        });
        useAppStore.getState().addToast({ type: 'success', title: 'Model uninstalled' });
      } catch (error) {
        useAppStore.getState().addToast({ type: 'error', title: 'Failed to uninstall model', description: String(error) });
        throw error;
      }
    },

    cancelInstall: async (jobId) => {
      try {
        await cancelModelInstall(jobId);
        set((state) => {
          const progress = state.installProgress.get(jobId);
          if (progress) {
            const updated = { ...progress, status: 'cancelled' as const };
            state.installProgress.set(jobId, updated);
          }
        });
      } catch (error) {
        useAppStore.getState().addToast({ type: 'error', title: 'Failed to cancel install', description: String(error) });
      }
    },

    pollInstallProgress: (jobId) => {
      const poll = async () => {
        try {
          const raw = await getModelInstallProgress(jobId);
          const progress: ModelInstallProgress = {
            job_id: jobId,
            model_id: String(raw['model_id'] ?? ''),
            status: String(raw['status'] ?? 'queued') as ModelInstallProgress['status'],
            progress: Number(raw['progress'] ?? 0),
            downloaded_bytes: Number(raw['downloaded_bytes'] ?? 0),
            total_bytes: Number(raw['total_bytes'] ?? 0),
            speed_bps: raw['speed_bps'] != null ? Number(raw['speed_bps']) : undefined,
            eta_seconds: raw['eta_seconds'] != null ? Number(raw['eta_seconds']) : undefined,
            error: raw['error'] != null ? String(raw['error']) : undefined,
          };

          set((state) => { state.installProgress.set(jobId, progress); });

          if (progress.status === 'completed') {
            set((state) => {
              const idx = state.models.findIndex((m) => m.id === progress.model_id);
              if (idx !== -1 && state.models[idx]) {
                state.models[idx]!.installed = 1;
              }
              state.activeInstalls.delete(progress.model_id);
            });
            useAppStore.getState().addToast({ type: 'success', title: 'Model installed successfully' });
          } else if (progress.status === 'failed') {
            set((state) => { state.activeInstalls.delete(progress.model_id); });
            useAppStore.getState().addToast({
              type: 'error',
              title: 'Model install failed',
              description: progress.error,
            });
          } else if (progress.status === 'running' || progress.status === 'queued') {
            setTimeout(poll, 1000);
          }
        } catch {
          setTimeout(poll, 2000);
        }
      };
      poll();
    },

    refreshRegistry: async () => {
      try {
        const models = await refreshModelRegistry();
        set((state) => { state.models = models; });
        useAppStore.getState().addToast({ type: 'success', title: 'Model registry refreshed' });
      } catch (error) {
        useAppStore.getState().addToast({ type: 'error', title: 'Failed to refresh registry', description: String(error) });
      }
    },

    getInstalledModels: (type) => {
      const { models } = get();
      return models.filter((m) => m.installed === 1 && (!type || m.type === type));
    },
  }))
);
