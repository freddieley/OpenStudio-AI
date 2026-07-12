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

export const listModels = (params?: {
  modelType?: string;
  installedOnly?: boolean;
}): Promise<Model[]> =>
  invoke('list_models', {
    modelType: params?.modelType ?? null,
    installedOnly: params?.installedOnly ?? null,
  });

export const getModel = (id: string): Promise<Model> => invoke('get_model', { id });

export const installModel = (id: string, installPath?: string): Promise<string> =>
  invoke('install_model', { input: { id, install_path: installPath ?? null } });

export const uninstallModel = (id: string): Promise<void> => invoke('uninstall_model', { id });

export const getModelInstallProgress = (jobId: string): Promise<Record<string, unknown>> =>
  invoke('get_model_install_progress', { jobId });

export const cancelModelInstall = (jobId: string): Promise<void> =>
  invoke('cancel_model_install', { jobId });

export const refreshModelRegistry = (): Promise<Record<string, unknown>[]> =>
  invoke('refresh_model_registry');

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const listJobs = (params?: {
  status?: string;
  jobType?: string;
  limit?: number;
}): Promise<Job[]> =>
  invoke('list_jobs', {
    status: params?.status ?? null,
    jobType: params?.jobType ?? null,
    limit: params?.limit ?? null,
  });

export const getJob = (id: string): Promise<Job> => invoke('get_job', { id });

export const cancelJob = (id: string): Promise<void> => invoke('cancel_job', { id });

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
