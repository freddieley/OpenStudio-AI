import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Workflow, WorkflowEdge, WorkflowNode } from '@/types';
import { deleteWorkflow, executeWorkflow, listWorkflows, loadWorkflow, saveWorkflow } from '@/utils/ipc';
import { useAppStore } from './app.store';
import { generateId } from '@/utils/helpers';

interface WorkflowStore {
  workflows: Workflow[];
  activeWorkflow: Workflow | null;
  isDirty: boolean;
  loading: boolean;
  executingJobId: string | null;

  // Actions
  loadWorkflows: (projectId?: string) => Promise<void>;
  createWorkflow: (name: string, description?: string) => void;
  loadWorkflow: (id: string) => Promise<void>;
  saveWorkflow: () => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  executeWorkflow: (params?: Record<string, unknown>) => Promise<void>;

  // Node graph mutations
  addNode: (node: WorkflowNode) => void;
  updateNode: (id: string, updates: Partial<WorkflowNode['data']>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: WorkflowEdge) => void;
  removeEdge: (id: string) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  updateNodeParam: (nodeId: string, paramKey: string, value: unknown) => void;
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
}

function makeEmptyWorkflow(name: string, description = ''): Workflow {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name,
    description,
    version: '1.0.0',
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    created_at: now,
    updated_at: now,
    tags: [],
    metadata: {},
  };
}

export const useWorkflowStore = create<WorkflowStore>()(
  immer((set, get) => ({
    workflows: [],
    activeWorkflow: null,
    isDirty: false,
    loading: false,
    executingJobId: null,

    loadWorkflows: async (projectId) => {
      set((state) => { state.loading = true; });
      try {
        const raw = await listWorkflows(projectId);
        const workflows = raw as unknown as Workflow[];
        set((state) => { state.workflows = workflows; state.loading = false; });
      } catch (error) {
        set((state) => { state.loading = false; });
        useAppStore.getState().addToast({ type: 'error', title: 'Failed to load workflows', description: String(error) });
      }
    },

    createWorkflow: (name, description) => {
      const workflow = makeEmptyWorkflow(name, description);
      set((state) => {
        state.activeWorkflow = workflow;
        state.isDirty = true;
      });
    },

    loadWorkflow: async (id) => {
      try {
        const workflow = await loadWorkflow(id);
        set((state) => {
          state.activeWorkflow = workflow;
          state.isDirty = false;
        });
      } catch (error) {
        useAppStore.getState().addToast({ type: 'error', title: 'Failed to load workflow', description: String(error) });
      }
    },

    saveWorkflow: async () => {
      const { activeWorkflow } = get();
      if (!activeWorkflow) return;

      try {
        const saved = await saveWorkflow({ ...activeWorkflow, updated_at: new Date().toISOString() });
        set((state) => {
          state.activeWorkflow = saved;
          state.isDirty = false;
          const idx = state.workflows.findIndex((w) => w.id === saved.id);
          if (idx !== -1) {
            state.workflows[idx] = saved;
          } else {
            state.workflows.unshift(saved);
          }
        });
        useAppStore.getState().addToast({ type: 'success', title: 'Workflow saved' });
      } catch (error) {
        useAppStore.getState().addToast({ type: 'error', title: 'Failed to save workflow', description: String(error) });
        throw error;
      }
    },

    deleteWorkflow: async (id) => {
      try {
        await deleteWorkflow(id);
        set((state) => {
          state.workflows = state.workflows.filter((w) => w.id !== id);
          if (state.activeWorkflow?.id === id) {
            state.activeWorkflow = null;
          }
        });
        useAppStore.getState().addToast({ type: 'success', title: 'Workflow deleted' });
      } catch (error) {
        useAppStore.getState().addToast({ type: 'error', title: 'Failed to delete workflow', description: String(error) });
      }
    },

    executeWorkflow: async (params) => {
      const { activeWorkflow } = get();
      if (!activeWorkflow) return;

      try {
        const jobId = await executeWorkflow(activeWorkflow.id, params);
        set((state) => { state.executingJobId = jobId; });
        useAppStore.getState().addToast({ type: 'info', title: 'Workflow started', description: `Job: ${jobId}` });
      } catch (error) {
        useAppStore.getState().addToast({ type: 'error', title: 'Failed to execute workflow', description: String(error) });
      }
    },

    addNode: (node) => {
      set((state) => {
        state.activeWorkflow?.nodes.push(node);
        state.isDirty = true;
      });
    },

    updateNode: (id, updates) => {
      set((state) => {
        const node = state.activeWorkflow?.nodes.find((n) => n.id === id);
        if (node) {
          Object.assign(node.data, updates);
          state.isDirty = true;
        }
      });
    },

    removeNode: (id) => {
      set((state) => {
        if (state.activeWorkflow) {
          state.activeWorkflow.nodes = state.activeWorkflow.nodes.filter((n) => n.id !== id);
          state.activeWorkflow.edges = state.activeWorkflow.edges.filter(
            (e) => e.source !== id && e.target !== id
          );
          state.isDirty = true;
        }
      });
    },

    addEdge: (edge) => {
      set((state) => {
        state.activeWorkflow?.edges.push(edge);
        state.isDirty = true;
      });
    },

    removeEdge: (id) => {
      set((state) => {
        if (state.activeWorkflow) {
          state.activeWorkflow.edges = state.activeWorkflow.edges.filter((e) => e.id !== id);
          state.isDirty = true;
        }
      });
    },

    updateNodePosition: (id, position) => {
      set((state) => {
        const node = state.activeWorkflow?.nodes.find((n) => n.id === id);
        if (node) {
          node.position = position;
          state.isDirty = true;
        }
      });
    },

    updateNodeParam: (nodeId, paramKey, value) => {
      set((state) => {
        const node = state.activeWorkflow?.nodes.find((n) => n.id === nodeId);
        if (node) {
          node.data.params[paramKey] = value;
          state.isDirty = true;
        }
      });
    },

    setViewport: (viewport) => {
      set((state) => {
        if (state.activeWorkflow) {
          state.activeWorkflow.viewport = viewport;
        }
      });
    },
  }))
);
