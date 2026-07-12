import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Job } from '@/types';
import { cancelJob, clearCompletedJobs, listJobs } from '@/utils/ipc';
import { useAppStore } from './app.store';

interface JobStore {
  jobs: Job[];
  loading: boolean;
  pollingActive: boolean;

  // Actions
  loadJobs: (params?: { status?: string; jobType?: string; limit?: number }) => Promise<void>;
  cancelJob: (id: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
  getActiveJobs: () => Job[];
  getJobsByType: (type: string) => Job[];
}

let _pollTimer: ReturnType<typeof setTimeout> | null = null;

export const useJobStore = create<JobStore>()(
  immer((set, get) => ({
    jobs: [],
    loading: false,
    pollingActive: false,

    loadJobs: async (params) => {
      set((state) => { state.loading = true; });
      try {
        const jobs = await listJobs(params);
        set((state) => { state.jobs = jobs; state.loading = false; });
      } catch (error) {
        set((state) => { state.loading = false; });
        console.error('Failed to load jobs:', error);
      }
    },

    cancelJob: async (id) => {
      try {
        await cancelJob(id);
        set((state) => {
          const idx = state.jobs.findIndex((j) => j.id === id);
          if (idx !== -1 && state.jobs[idx]) {
            state.jobs[idx]!.status = 'cancelled';
          }
        });
      } catch (error) {
        useAppStore.getState().addToast({ type: 'error', title: 'Failed to cancel job', description: String(error) });
        throw error;
      }
    },

    clearCompleted: async () => {
      try {
        const count = await clearCompletedJobs();
        set((state) => {
          state.jobs = state.jobs.filter(
            (j) => !['completed', 'failed', 'cancelled'].includes(j.status)
          );
        });
        useAppStore.getState().addToast({ type: 'info', title: `Cleared ${count} completed jobs` });
      } catch (error) {
        useAppStore.getState().addToast({ type: 'error', title: 'Failed to clear jobs', description: String(error) });
      }
    },

    startPolling: (intervalMs = 2000) => {
      if (get().pollingActive) return;
      set((state) => { state.pollingActive = true; });

      const poll = async () => {
        await get().loadJobs({ limit: 100 });
        if (get().pollingActive) {
          _pollTimer = setTimeout(poll, intervalMs);
        }
      };
      poll();
    },

    stopPolling: () => {
      set((state) => { state.pollingActive = false; });
      if (_pollTimer) {
        clearTimeout(_pollTimer);
        _pollTimer = null;
      }
    },

    getActiveJobs: () => {
      return get().jobs.filter((j) => j.status === 'running' || j.status === 'queued');
    },

    getJobsByType: (type) => {
      return get().jobs.filter((j) => j.type === type);
    },
  }))
);
