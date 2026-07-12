import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Project, CreateProjectInput } from '@/types';
import {
  createProject,
  deleteProject,
  listProjects,
  openProject,
  saveProject,
} from '@/utils/ipc';
import { useAppStore } from './app.store';

interface ProjectStore {
  projects: Project[];
  activeProject: Project | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadProjects: () => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<Project>;
  openProject: (id: string) => Promise<void>;
  saveActiveProject: (metadata?: Record<string, unknown>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setActiveProject: (project: Project | null) => void;
}

export const useProjectStore = create<ProjectStore>()(
  immer((set, get) => ({
    projects: [],
    activeProject: null,
    loading: false,
    error: null,

    loadProjects: async () => {
      set((state) => { state.loading = true; state.error = null; });
      try {
        const projects = await listProjects();
        set((state) => { state.projects = projects; state.loading = false; });
      } catch (error) {
        const msg = String(error);
        set((state) => { state.loading = false; state.error = msg; });
        useAppStore.getState().addToast({ type: 'error', title: 'Failed to load projects', description: msg });
      }
    },

    createProject: async (input) => {
      try {
        const project = await createProject(input);
        set((state) => { state.projects.unshift(project); });
        useAppStore.getState().addToast({ type: 'success', title: 'Project created', description: project.name });
        return project;
      } catch (error) {
        const msg = String(error);
        useAppStore.getState().addToast({ type: 'error', title: 'Failed to create project', description: msg });
        throw error;
      }
    },

    openProject: async (id) => {
      try {
        const project = await openProject(id);
        set((state) => { state.activeProject = project; });
      } catch (error) {
        const msg = String(error);
        useAppStore.getState().addToast({ type: 'error', title: 'Failed to open project', description: msg });
        throw error;
      }
    },

    saveActiveProject: async (metadata = {}) => {
      const { activeProject } = get();
      if (!activeProject) return;
      try {
        await saveProject(activeProject.id, { ...activeProject.metadata, ...metadata });
        set((state) => {
          if (state.activeProject) {
            state.activeProject.metadata = { ...state.activeProject.metadata, ...metadata };
          }
        });
      } catch (error) {
        useAppStore.getState().addToast({ type: 'error', title: 'Failed to save project', description: String(error) });
      }
    },

    deleteProject: async (id) => {
      try {
        await deleteProject(id);
        set((state) => {
          state.projects = state.projects.filter((p) => p.id !== id);
          if (state.activeProject?.id === id) {
            state.activeProject = null;
          }
        });
        useAppStore.getState().addToast({ type: 'success', title: 'Project deleted' });
      } catch (error) {
        useAppStore.getState().addToast({ type: 'error', title: 'Failed to delete project', description: String(error) });
        throw error;
      }
    },

    setActiveProject: (project) => {
      set((state) => { state.activeProject = project; });
    },
  }))
);
