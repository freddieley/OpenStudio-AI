/**
 * OpenStudio AI — TypeScript Plugin SDK
 *
 * Provides types and utilities for building OpenStudio AI frontend plugins.
 */

export type PortType =
  | 'image' | 'video' | 'audio' | 'text' | 'number'
  | 'boolean' | 'array' | 'object' | 'model' | 'latent'
  | 'conditioning' | 'mask' | 'any';

export interface PortDefinition {
  id: string;
  name: string;
  type: PortType;
  required: boolean;
  default?: unknown;
  description?: string;
  multiple?: boolean;
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

export interface NodeDefinition {
  metadata: NodeMetadata;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage?: string;
  entry_point: string;
  permissions: string[];
  contributes: {
    nodes?: string[];
    models?: string[];
    effects?: string[];
    menu_items?: MenuItem[];
    importers?: string[];
    exporters?: string[];
  };
  min_app_version?: string;
}

export interface MenuItem {
  id: string;
  label: string;
  location: 'file' | 'edit' | 'view' | 'tools' | 'help';
  shortcut?: string;
  command: string;
}

/**
 * Plugin interface — implement this to create a frontend plugin.
 */
export interface IPlugin {
  manifest: PluginManifest;
  nodes?: NodeDefinition[];
  onLoad?: () => void | Promise<void>;
  onUnload?: () => void | Promise<void>;
}

/**
 * Plugin registry — used internally by the plugin loader.
 */
class PluginRegistry {
  private plugins = new Map<string, IPlugin>();
  private nodes = new Map<string, NodeDefinition>();

  register(plugin: IPlugin): void {
    this.plugins.set(plugin.manifest.id, plugin);
    for (const node of plugin.nodes ?? []) {
      this.nodes.set(node.metadata.id, node);
    }
    plugin.onLoad?.();
    console.info(`[PluginSDK] Loaded plugin: ${plugin.manifest.name} v${plugin.manifest.version}`);
  }

  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    plugin?.onUnload?.();
    this.plugins.delete(pluginId);
    // Remove nodes provided by this plugin
    for (const node of plugin?.nodes ?? []) {
      this.nodes.delete(node.metadata.id);
    }
  }

  getPlugin(id: string): IPlugin | undefined {
    return this.plugins.get(id);
  }

  getAllPlugins(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  getNode(id: string): NodeDefinition | undefined {
    return this.nodes.get(id);
  }

  getAllNodes(): NodeDefinition[] {
    return Array.from(this.nodes.values());
  }
}

export const pluginRegistry = new PluginRegistry();

/**
 * Helper to define a plugin in a type-safe way.
 *
 * @example
 * export default definePlugin({
 *   manifest: { id: 'my-plugin', name: 'My Plugin', ... },
 *   nodes: [myCustomNode],
 *   onLoad() { console.log('Plugin loaded!') },
 * });
 */
export function definePlugin(plugin: IPlugin): IPlugin {
  return plugin;
}

/**
 * Helper to define a node definition.
 */
export function defineNode(def: NodeDefinition): NodeDefinition {
  return def;
}
