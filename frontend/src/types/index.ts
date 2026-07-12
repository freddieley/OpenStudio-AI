// ─── Shared primitive types ────────────────────────────────────────────────────

export type ID = string;
export type Timestamp = string; // ISO-8601 datetime string
export type FilePath = string;

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
}

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  status: AsyncStatus;
  error: string | null;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface Project {
  id: ID;
  name: string;
  description: string;
  path: FilePath;
  thumbnail?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  metadata: Record<string, unknown>;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  path: FilePath;
  template?: string;
}

// ─── Model ────────────────────────────────────────────────────────────────────

export type ModelType =
  | 'image-generation'
  | 'video-generation'
  | 'speech-recognition'
  | 'tts'
  | 'voice-cloning'
  | 'lip-sync'
  | 'upscaling'
  | 'background-removal'
  | 'caption-generation'
  | 'llm'
  | 'lora'
  | 'vae'
  | 'controlnet'
  | 'embedding'
  | 'other';

export interface Model {
  id: ID;
  name: string;
  type: ModelType;
  variant: string;
  description: string;
  author: string;
  license: string;
  version: string;
  size_bytes: number;
  vram_mb: number;
  installed: number; // 0 or 1
  install_path?: string;
  download_url?: string;
  sha256?: string;
  thumbnail?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ModelInstallProgress {
  job_id: ID;
  model_id: ID;
  status: JobStatus;
  progress: number;
  downloaded_bytes: number;
  total_bytes: number;
  speed_bps?: number;
  eta_seconds?: number;
  error?: string;
}

// ─── Job ──────────────────────────────────────────────────────────────────────

export type JobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export type JobType =
  | 'model-install'
  | 'image-generation'
  | 'video-generation'
  | 'speech-recognition'
  | 'tts'
  | 'voice-cloning'
  | 'lip-sync'
  | 'upscaling'
  | 'background-removal'
  | 'caption-generation'
  | 'frame-interpolation'
  | 'workflow-execution'
  | 'export'
  | 'training'
  | string;

export interface Job {
  id: ID;
  type: JobType;
  status: JobStatus;
  priority: number;
  progress: number;
  result?: string;
  error?: string;
  input_params: Record<string, unknown>;
  output_files: string[];
  model_id?: ID;
  project_id?: ID;
  created_at: Timestamp;
  started_at?: Timestamp;
  completed_at?: Timestamp;
  duration_ms?: number;
}

// ─── Workflow / Node Graph ────────────────────────────────────────────────────

export type PortType =
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'model'
  | 'latent'
  | 'conditioning'
  | 'mask'
  | 'any';

export interface PortDefinition {
  id: string;
  name: string;
  type: PortType;
  required: boolean;
  default?: unknown;
  description?: string;
  multiple?: boolean; // allow multiple connections
}

export interface NodeMetadata {
  id: string;
  name: string;
  category: string;
  description: string;
  version: string;
  author: string;
  color?: string;
  icon?: string;
  tags?: string[];
  deprecated?: boolean;
}

export interface WorkflowNode {
  id: ID;
  type: string; // node type identifier
  position: { x: number; y: number };
  data: {
    metadata: NodeMetadata;
    inputs: PortDefinition[];
    outputs: PortDefinition[];
    params: Record<string, unknown>;
    label?: string;
  };
  selected?: boolean;
  dragging?: boolean;
}

export interface WorkflowEdge {
  id: ID;
  source: ID;
  sourceHandle: string;
  target: ID;
  targetHandle: string;
  type?: string;
  animated?: boolean;
}

export interface Workflow {
  id: ID;
  name: string;
  description: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: { x: number; y: number; zoom: number };
  created_at: Timestamp;
  updated_at: Timestamp;
  project_id?: ID;
  tags: string[];
  metadata: Record<string, unknown>;
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export interface Plugin {
  id: ID;
  name: string;
  version: string;
  description: string;
  author: string;
  entry_point: string;
  enabled: number; // 0 or 1
  installed: number; // 0 or 1
  install_path?: string;
  manifest: PluginManifest;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  license: string;
  entry_point: string;
  permissions: string[];
  contributes: {
    nodes?: string[];
    models?: string[];
    effects?: string[];
    menu_items?: PluginMenuItem[];
    importers?: string[];
    exporters?: string[];
  };
  dependencies?: Record<string, string>;
  min_app_version?: string;
}

export interface PluginMenuItem {
  id: string;
  label: string;
  location: 'file' | 'edit' | 'view' | 'tools' | 'help';
  shortcut?: string;
  command: string;
}

// ─── Asset ────────────────────────────────────────────────────────────────────

export type AssetType = 'image' | 'video' | 'audio' | 'model' | 'file';

export interface Asset {
  id: ID;
  name: string;
  type: AssetType;
  mime_type: string;
  path: FilePath;
  thumbnail_path?: string;
  size_bytes: number;
  width?: number;
  height?: number;
  duration_sec?: number;
  project_id?: ID;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: Timestamp;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  language: string;
  python_path: string;
  backend_port: number;
  gpu_enabled: boolean;
  gpu_vram_budget_mb: number;
  default_image_width: number;
  default_image_height: number;
  output_directory: string;
  auto_save_interval_sec: number;
  telemetry_enabled: boolean;
  first_run: boolean;
  [key: string]: unknown;
}

export interface SettingsFieldSchema {
  type: 'string' | 'integer' | 'boolean' | 'path';
  label: string;
  description: string;
  default: unknown;
  group: string;
  enum?: unknown[];
  min?: number;
  max?: number;
}

// ─── UI ───────────────────────────────────────────────────────────────────────

export type PanelId =
  | 'project-manager'
  | 'asset-browser'
  | 'timeline'
  | 'workflow-editor'
  | 'image-generator'
  | 'video-studio'
  | 'voice-studio'
  | 'model-manager'
  | 'plugin-manager'
  | 'settings'
  | 'job-queue'
  | 'preview'
  | 'export-manager'
  | 'node-editor';

export interface PanelConfig {
  id: PanelId;
  title: string;
  icon: string;
  component: string;
  closeable: boolean;
  floatable: boolean;
  defaultPosition: 'left' | 'right' | 'bottom' | 'center' | 'float';
  minWidth?: number;
  minHeight?: number;
}

export interface Toast {
  id: ID;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface CommandPaletteEntry {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  icon?: string;
  category?: string;
  action: () => void | Promise<void>;
}

// ─── System ───────────────────────────────────────────────────────────────────

export interface GpuInfo {
  name: string;
  vram_mb: number;
  available_vram_mb: number;
  backend: string;
}

export interface SystemInfo {
  os: string;
  arch: string;
  cpu_cores: number;
  total_memory_mb: number;
  available_memory_mb: number;
  gpu_info: GpuInfo[];
}

export interface BackendStatus {
  running: boolean;
  port?: number;
  version?: string;
  healthy: boolean;
}

export interface AppInfo {
  name: string;
  version: string;
  tauri_version: string;
  build_date: string;
  debug: boolean;
}
