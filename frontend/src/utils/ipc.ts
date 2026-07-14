import { invoke } from '@tauri-apps/api/core';
import type {
  AppInfo,
  AppSettings,
  Asset,
  BackendStatus,
  CreateProjectInput,
  Job,
  Model,
  Plugin,
  Project,
  SettingsFieldSchema,
  SystemInfo,
  Workflow,
} from '@/types';

// ─── App ──────────────────────────────────────────────────────────────────────

export const getAppInfo = (): Promise<AppInfo> => invoke('get_app_info');

export const getSystemInfo = (): Promise<SystemInfo> => invoke('get_system_info');

export const checkForUpdates = (): Promise<{ available: boolean; version?: string }> =>
  invoke('check_for_updates');

// ─── Project ──────────────────────────────────────────────────────────────────

export const listProjects = (): Promise<Project[]> => invoke('list_projects');

export const getProject = (id: string): Promise<Project> => invoke('get_project', { id });

export const createProject = (input: CreateProjectInput): Promise<Project> =>
  invoke('create_project', { input });

export const openProject = (id: string): Promise<Project> => invoke('open_project', { id });

export const saveProject = (id: string, metadata: Record<string, unknown>): Promise<void> =>
  invoke('save_project', { id, metadata });

export const deleteProject = (id: string): Promise<void> => invoke('delete_project', { id });

// ─── Models ───────────────────────────────────────────────────────────────────

export const listModels = async (params?: {
  modelType?: string;
  installedOnly?: boolean;
}): Promise<Model[]> => {
  const query = new URLSearchParams();
  if (params?.modelType) query.set('model_type', params.modelType);
  if (params?.installedOnly) query.set('installed_only', 'true');
  const qs = query.toString();
  const response = await proxyRequest('GET', `/api/models${qs ? `?${qs}` : ''}`) as { models: Model[] };
  return response.models ?? [];
};

export const getModel = async (id: string): Promise<Model> => {
  const response = await proxyRequest('GET', `/api/models/${id}`) as Model;
  return response;
};

export const installModel = (id: string, installPath?: string): Promise<string> =>
  invoke('install_model', { input: { id, install_path: installPath ?? null } });

export const uninstallModel = (id: string): Promise<void> => invoke('uninstall_model', { id });

export const getModelInstallProgress = (jobId: string): Promise<Record<string, unknown>> =>
  invoke('get_model_install_progress', { jobId });

export const cancelModelInstall = (jobId: string): Promise<void> =>
  invoke('cancel_model_install', { jobId });

export const refreshModelRegistry = async (): Promise<Model[]> => {
  const response = await proxyRequest('GET', '/api/models/registry/refresh') as { models: Model[] };
  return response.models ?? [];
};

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const listJobs = async (params?: {
  status?: string;
  jobType?: string;
  limit?: number;
}): Promise<Job[]> => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.jobType) query.set('job_type', params.jobType);
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  const response = await proxyRequest('GET', `/api/jobs${qs ? `?${qs}` : ''}`) as { jobs: Job[] };
  // Python returns Unix timestamps (float seconds); convert to ISO strings
  return (response.jobs ?? []).map((j) => ({
    ...j,
    created_at: typeof j.created_at === 'number' ? new Date(j.created_at * 1000).toISOString() : j.created_at,
    started_at: typeof j.started_at === 'number' ? new Date(j.started_at * 1000).toISOString() : j.started_at,
    completed_at: typeof j.completed_at === 'number' ? new Date(j.completed_at * 1000).toISOString() : j.completed_at,
  }));
};

export const getJob = async (id: string): Promise<Job> => {
  const j = await proxyRequest('GET', `/api/jobs/${id}`) as Job;
  return {
    ...j,
    created_at: typeof j.created_at === 'number' ? new Date((j.created_at as unknown as number) * 1000).toISOString() : j.created_at,
  };
};

export const cancelJob = async (id: string): Promise<void> => {
  await proxyRequest('POST', `/api/jobs/${id}/cancel`);
};

export const clearCompletedJobs = (): Promise<number> => invoke('clear_completed_jobs');

// ─── Settings ─────────────────────────────────────────────────────────────────

export const getSettings = (): Promise<AppSettings> => invoke('get_settings');

export const updateSettings = (updates: Partial<AppSettings>): Promise<AppSettings> =>
  invoke('update_settings', { updates });

export const resetSettings = (): Promise<AppSettings> => invoke('reset_settings');

export const getSettingsSchema = (): Promise<Record<string, SettingsFieldSchema>> =>
  invoke('get_settings_schema');

// ─── Plugins ──────────────────────────────────────────────────────────────────

export const listPlugins = (): Promise<Plugin[]> => invoke('list_plugins');

export const enablePlugin = (id: string): Promise<void> => invoke('enable_plugin', { id });

export const disablePlugin = (id: string): Promise<void> => invoke('disable_plugin', { id });

export const installPlugin = (source: string): Promise<Plugin> =>
  invoke('install_plugin', { source });

export const uninstallPlugin = (id: string): Promise<void> => invoke('uninstall_plugin', { id });

export const getPluginMarketplace = (): Promise<Record<string, unknown>[]> =>
  invoke('get_plugin_marketplace');

// ─── Assets ───────────────────────────────────────────────────────────────────

export const listAssets = (params?: {
  projectId?: string;
  assetType?: string;
}): Promise<Asset[]> =>
  invoke('list_assets', {
    projectId: params?.projectId ?? null,
    assetType: params?.assetType ?? null,
  });

export const importAsset = (params: {
  path: string;
  projectId?: string;
  tags?: string[];
}): Promise<Asset> =>
  invoke('import_asset', {
    input: {
      path: params.path,
      project_id: params.projectId ?? null,
      tags: params.tags ?? null,
    },
  });

export const deleteAsset = (id: string): Promise<void> => invoke('delete_asset', { id });

export const getAssetThumbnail = (id: string): Promise<string | null> =>
  invoke('get_asset_thumbnail', { id });

// ─── Workflows ────────────────────────────────────────────────────────────────

export const listWorkflows = (projectId?: string): Promise<Record<string, unknown>[]> =>
  invoke('list_workflows', { projectId: projectId ?? null });

export const saveWorkflow = (workflow: Workflow): Promise<Workflow> =>
  invoke('save_workflow', { workflow });

export const loadWorkflow = (id: string): Promise<Workflow> => invoke('load_workflow', { id });

export const deleteWorkflow = (id: string): Promise<void> => invoke('delete_workflow', { id });

export const executeWorkflow = (workflowId: string, params?: Record<string, unknown>): Promise<string> =>
  invoke('execute_workflow', { workflowId, params: params ?? null });

// ─── Python Backend ───────────────────────────────────────────────────────────

export const proxyRequest = (
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> =>
  invoke('proxy_request', { request: { method, path, body: body ?? null } });

export const getBackendStatus = (): Promise<BackendStatus> => invoke('get_backend_status');
