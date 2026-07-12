import type { PortDefinition, NodeMetadata } from '@/types';

interface NodeDefinition {
  metadata: NodeMetadata;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
}

export const NODE_REGISTRY: Record<string, NodeDefinition> = {
  // ─── Image Generation ──────────────────────────────────────────────────────
  'image-generate': {
    metadata: {
      id: 'image-generate',
      name: 'Generate Image',
      category: 'Image',
      description: 'Generate an image using a diffusion model',
      version: '1.0.0',
      author: 'OpenStudio AI',
      color: '#7c3aed',
    },
    inputs: [
      { id: 'prompt', name: 'Prompt', type: 'text', required: true },
      { id: 'negative_prompt', name: 'Negative Prompt', type: 'text', required: false },
      { id: 'model', name: 'Model', type: 'model', required: true },
      { id: 'width', name: 'Width', type: 'number', required: false, default: 1024 },
      { id: 'height', name: 'Height', type: 'number', required: false, default: 1024 },
      { id: 'steps', name: 'Steps', type: 'number', required: false, default: 20 },
      { id: 'cfg_scale', name: 'CFG Scale', type: 'number', required: false, default: 7.5 },
      { id: 'seed', name: 'Seed', type: 'number', required: false, default: -1 },
      { id: 'conditioning', name: 'Conditioning', type: 'conditioning', required: false },
      { id: 'mask', name: 'Mask', type: 'mask', required: false },
    ],
    outputs: [
      { id: 'image', name: 'Image', type: 'image', required: false },
      { id: 'latent', name: 'Latent', type: 'latent', required: false },
    ],
  },

  // ─── Text ──────────────────────────────────────────────────────────────────
  'text-input': {
    metadata: {
      id: 'text-input',
      name: 'Text Input',
      category: 'Text',
      description: 'Static text / prompt input',
      version: '1.0.0',
      author: 'OpenStudio AI',
      color: '#eab308',
    },
    inputs: [],
    outputs: [
      { id: 'text', name: 'Text', type: 'text', required: false },
    ],
  },

  'text-combine': {
    metadata: {
      id: 'text-combine',
      name: 'Combine Text',
      category: 'Text',
      description: 'Concatenate two text inputs',
      version: '1.0.0',
      author: 'OpenStudio AI',
      color: '#eab308',
    },
    inputs: [
      { id: 'text_a', name: 'Text A', type: 'text', required: true },
      { id: 'text_b', name: 'Text B', type: 'text', required: true },
      { id: 'separator', name: 'Separator', type: 'text', required: false, default: ', ' },
    ],
    outputs: [
      { id: 'text', name: 'Text', type: 'text', required: false },
    ],
  },

  'llm-generate': {
    metadata: {
      id: 'llm-generate',
      name: 'LLM Generate',
      category: 'Text',
      description: 'Generate text using a local LLM',
      version: '1.0.0',
      author: 'OpenStudio AI',
      color: '#eab308',
    },
    inputs: [
      { id: 'prompt', name: 'Prompt', type: 'text', required: true },
      { id: 'system_prompt', name: 'System Prompt', type: 'text', required: false },
      { id: 'model', name: 'Model', type: 'model', required: true },
      { id: 'max_tokens', name: 'Max Tokens', type: 'number', required: false, default: 512 },
      { id: 'temperature', name: 'Temperature', type: 'number', required: false, default: 0.7 },
    ],
    outputs: [
      { id: 'text', name: 'Text', type: 'text', required: false },
    ],
  },

  // ─── Image Processing ──────────────────────────────────────────────────────
  'image-upscale': {
    metadata: {
      id: 'image-upscale',
      name: 'Upscale Image',
      category: 'Image',
      description: 'Upscale an image using AI',
      version: '1.0.0',
      author: 'OpenStudio AI',
      color: '#f97316',
    },
    inputs: [
      { id: 'image', name: 'Image', type: 'image', required: true },
      { id: 'model', name: 'Model', type: 'model', required: true },
      { id: 'scale', name: 'Scale', type: 'number', required: false, default: 4 },
    ],
    outputs: [
      { id: 'image', name: 'Image', type: 'image', required: false },
    ],
  },

  'background-remove': {
    metadata: {
      id: 'background-remove',
      name: 'Remove Background',
      category: 'Image',
      description: 'Remove background from an image',
      version: '1.0.0',
      author: 'OpenStudio AI',
      color: '#f97316',
    },
    inputs: [
      { id: 'image', name: 'Image', type: 'image', required: true },
    ],
    outputs: [
      { id: 'image', name: 'Image', type: 'image', required: false },
      { id: 'mask', name: 'Mask', type: 'mask', required: false },
    ],
  },

  // ─── Audio ─────────────────────────────────────────────────────────────────
  'speech-transcribe': {
    metadata: {
      id: 'speech-transcribe',
      name: 'Transcribe Audio',
      category: 'Audio',
      description: 'Transcribe audio to text using Whisper',
      version: '1.0.0',
      author: 'OpenStudio AI',
      color: '#22c55e',
    },
    inputs: [
      { id: 'audio', name: 'Audio', type: 'audio', required: true },
      { id: 'language', name: 'Language', type: 'text', required: false, default: 'auto' },
      { id: 'model', name: 'Model', type: 'model', required: false },
    ],
    outputs: [
      { id: 'text', name: 'Text', type: 'text', required: false },
      { id: 'segments', name: 'Segments', type: 'array', required: false },
    ],
  },

  'tts-generate': {
    metadata: {
      id: 'tts-generate',
      name: 'Text to Speech',
      category: 'Audio',
      description: 'Convert text to speech',
      version: '1.0.0',
      author: 'OpenStudio AI',
      color: '#22c55e',
    },
    inputs: [
      { id: 'text', name: 'Text', type: 'text', required: true },
      { id: 'voice', name: 'Voice', type: 'audio', required: false },
      { id: 'model', name: 'Model', type: 'model', required: false },
      { id: 'language', name: 'Language', type: 'text', required: false, default: 'en' },
      { id: 'speed', name: 'Speed', type: 'number', required: false, default: 1.0 },
    ],
    outputs: [
      { id: 'audio', name: 'Audio', type: 'audio', required: false },
    ],
  },

  // ─── Video ─────────────────────────────────────────────────────────────────
  'video-interpolate': {
    metadata: {
      id: 'video-interpolate',
      name: 'Frame Interpolation',
      category: 'Video',
      description: 'Increase video frame rate using AI interpolation',
      version: '1.0.0',
      author: 'OpenStudio AI',
      color: '#3b82f6',
    },
    inputs: [
      { id: 'video', name: 'Video', type: 'video', required: true },
      { id: 'multiplier', name: 'FPS Multiplier', type: 'number', required: false, default: 2 },
      { id: 'model', name: 'Model', type: 'model', required: false },
    ],
    outputs: [
      { id: 'video', name: 'Video', type: 'video', required: false },
    ],
  },

  'lip-sync': {
    metadata: {
      id: 'lip-sync',
      name: 'Lip Sync',
      category: 'Video',
      description: 'Synchronize lip movements with audio',
      version: '1.0.0',
      author: 'OpenStudio AI',
      color: '#3b82f6',
    },
    inputs: [
      { id: 'video', name: 'Video', type: 'video', required: true },
      { id: 'audio', name: 'Audio', type: 'audio', required: true },
      { id: 'model', name: 'Model', type: 'model', required: false },
    ],
    outputs: [
      { id: 'video', name: 'Video', type: 'video', required: false },
    ],
  },

  // ─── I/O ───────────────────────────────────────────────────────────────────
  'load-image': {
    metadata: {
      id: 'load-image',
      name: 'Load Image',
      category: 'I/O',
      description: 'Load an image file from disk',
      version: '1.0.0',
      author: 'OpenStudio AI',
      color: '#64748b',
    },
    inputs: [
      { id: 'path', name: 'File Path', type: 'text', required: false },
    ],
    outputs: [
      { id: 'image', name: 'Image', type: 'image', required: false },
      { id: 'width', name: 'Width', type: 'number', required: false },
      { id: 'height', name: 'Height', type: 'number', required: false },
    ],
  },

  'save-image': {
    metadata: {
      id: 'save-image',
      name: 'Save Image',
      category: 'I/O',
      description: 'Save an image to disk',
      version: '1.0.0',
      author: 'OpenStudio AI',
      color: '#64748b',
    },
    inputs: [
      { id: 'image', name: 'Image', type: 'image', required: true },
      { id: 'path', name: 'Output Path', type: 'text', required: false },
      { id: 'format', name: 'Format', type: 'text', required: false, default: 'png' },
    ],
    outputs: [
      { id: 'path', name: 'Saved Path', type: 'text', required: false },
    ],
  },
};
