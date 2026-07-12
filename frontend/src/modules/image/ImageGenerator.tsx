import { useState, useCallback } from 'react';
import { Image, Wand2, RefreshCw, Download, Copy, Settings2 } from 'lucide-react';
import { useModelStore } from '@/stores/model.store';
import { useJobStore } from '@/stores/job.store';
import { useAppStore } from '@/stores/app.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { proxyRequest } from '@/utils/ipc';
import * as Slider from '@radix-ui/react-slider';
import * as Progress from '@radix-ui/react-progress';
import { clsx } from 'clsx';
import { generateId } from '@/utils/helpers';

interface GenerationParams {
  prompt: string;
  negative_prompt: string;
  model_id: string;
  width: number;
  height: number;
  steps: number;
  cfg_scale: number;
  seed: number;
  sampler: string;
  batch_size: number;
  lora_weights: Array<{ id: string; weight: number }>;
}

const SAMPLERS = ['DPM++ 2M Karras', 'Euler a', 'Euler', 'DDIM', 'PNDM', 'UniPC'];

const RESOLUTIONS = [
  { label: '512×512', w: 512, h: 512 },
  { label: '768×768', w: 768, h: 768 },
  { label: '1024×1024', w: 1024, h: 1024 },
  { label: '1024×576 (16:9)', w: 1024, h: 576 },
  { label: '576×1024 (9:16)', w: 576, h: 1024 },
  { label: '1216×832 (3:2)', w: 1216, h: 832 },
  { label: 'Custom', w: 0, h: 0 },
];

const DEFAULT_PARAMS: GenerationParams = {
  prompt: '',
  negative_prompt: 'blurry, bad quality, deformed, ugly, low resolution',
  model_id: '',
  width: 1024,
  height: 1024,
  steps: 20,
  cfg_scale: 7.5,
  seed: -1,
  sampler: 'DPM++ 2M Karras',
  batch_size: 1,
  lora_weights: [],
};

export default function ImageGenerator() {
  const imageModels = useModelStore((s) => s.getInstalledModels('image-generation'));
  const loraModels = useModelStore((s) => s.getInstalledModels('lora'));
  const addToast = useAppStore((s) => s.addToast);

  const [params, setParams] = useState<GenerationParams>(DEFAULT_PARAMS);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const setParam = useCallback(<K extends keyof GenerationParams>(key: K, value: GenerationParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
  }, []);

  const handleGenerate = async () => {
    if (!params.prompt.trim()) { addToast({ type: 'error', title: 'Prompt is required' }); return; }
    if (!params.model_id) { addToast({ type: 'error', title: 'Select a model first' }); return; }

    setGenerating(true);
    setProgress(0);
    setGeneratedImages([]);

    try {
      const response = await proxyRequest('POST', '/api/generate/image', params) as Record<string, unknown>;
      const newJobId = response['job_id'] as string;
      setJobId(newJobId);

      // Poll for completion
      const poll = async () => {
        const status = await proxyRequest('GET', `/api/jobs/${newJobId}`) as Record<string, unknown>;
        const pct = Number(status['progress'] ?? 0);
        setProgress(pct);

        if (status['status'] === 'completed') {
          const output = (status['output_files'] as string[]) ?? [];
          setGeneratedImages(output);
          if (output.length > 0) setSelectedImage(output[0] ?? null);
          setGenerating(false);
          setJobId(null);
          addToast({ type: 'success', title: `Generated ${output.length} image(s)` });
        } else if (status['status'] === 'failed') {
          setGenerating(false);
          setJobId(null);
          addToast({ type: 'error', title: 'Generation failed', description: status['error'] as string });
        } else {
          setTimeout(poll, 500);
        }
      };
      setTimeout(poll, 500);
    } catch (error) {
      setGenerating(false);
      addToast({ type: 'error', title: 'Failed to start generation', description: String(error) });
    }
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: Parameters panel */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-studio-border bg-studio-panel overflow-y-auto">
        <div className="panel-header">
          <Image className="w-3.5 h-3.5" />
          Image Generator
        </div>

        <div className="flex flex-col gap-4 p-4">
          {/* Model selector */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-studio-text">Model</label>
            <select
              value={params.model_id}
              onChange={(e) => setParam('model_id', e.target.value)}
              className="h-8 px-2 text-xs rounded bg-studio-bg border border-studio-border text-studio-text focus:outline-none focus:border-studio-accent"
            >
              <option value="">Select model...</option>
              {imageModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Prompt */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-studio-text">Prompt</label>
            <textarea
              value={params.prompt}
              onChange={(e) => setParam('prompt', e.target.value)}
              placeholder="A beautiful landscape with mountains..."
              rows={4}
              className="w-full rounded bg-studio-bg border border-studio-border text-sm text-studio-text placeholder:text-studio-text-muted px-2.5 py-1.5 focus:outline-none focus:border-studio-accent resize-none"
            />
          </div>

          {/* Negative prompt */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-studio-text">Negative Prompt</label>
            <textarea
              value={params.negative_prompt}
              onChange={(e) => setParam('negative_prompt', e.target.value)}
              rows={2}
              className="w-full rounded bg-studio-bg border border-studio-border text-sm text-studio-text placeholder:text-studio-text-muted px-2.5 py-1.5 focus:outline-none focus:border-studio-accent resize-none"
            />
          </div>

          {/* Resolution */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-studio-text">Resolution</label>
            <div className="grid grid-cols-2 gap-1">
              {RESOLUTIONS.filter((r) => r.w > 0).map((r) => (
                <button
                  key={r.label}
                  onClick={() => { setParam('width', r.w); setParam('height', r.h); }}
                  className={clsx(
                    'px-2 py-1 text-xs rounded border transition-colors',
                    params.width === r.w && params.height === r.h
                      ? 'border-studio-accent bg-studio-accent/10 text-studio-accent-light'
                      : 'border-studio-border text-studio-text-muted hover:border-studio-muted'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                label="W"
                type="number"
                value={params.width}
                onChange={(e) => setParam('width', Number(e.target.value))}
                className="w-20"
              />
              <Input
                label="H"
                type="number"
                value={params.height}
                onChange={(e) => setParam('height', Number(e.target.value))}
                className="w-20"
              />
            </div>
          </div>

          {/* Steps */}
          <SliderParam
            label="Steps"
            value={params.steps}
            min={1}
            max={150}
            step={1}
            onChange={(v) => setParam('steps', v)}
          />

          {/* CFG Scale */}
          <SliderParam
            label="CFG Scale"
            value={params.cfg_scale}
            min={1}
            max={20}
            step={0.5}
            onChange={(v) => setParam('cfg_scale', v)}
          />

          {/* Sampler */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-studio-text">Sampler</label>
            <select
              value={params.sampler}
              onChange={(e) => setParam('sampler', e.target.value)}
              className="h-8 px-2 text-xs rounded bg-studio-bg border border-studio-border text-studio-text focus:outline-none focus:border-studio-accent"
            >
              {SAMPLERS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Seed */}
          <div className="flex items-end gap-2">
            <Input
              label="Seed"
              type="number"
              value={params.seed}
              onChange={(e) => setParam('seed', Number(e.target.value))}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              title="Random seed"
              onClick={() => setParam('seed', -1)}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Batch size */}
          <SliderParam
            label="Batch Size"
            value={params.batch_size}
            min={1}
            max={8}
            step={1}
            onChange={(v) => setParam('batch_size', v)}
          />
        </div>

        {/* Generate button */}
        <div className="p-4 border-t border-studio-border mt-auto">
          {generating && (
            <div className="mb-3">
              <Progress.Root className="h-1.5 rounded-full bg-studio-border overflow-hidden">
                <Progress.Indicator
                  className="h-full bg-studio-accent transition-all"
                  style={{ width: `${progress * 100}%` }}
                />
              </Progress.Root>
              <div className="flex justify-between text-[10px] text-studio-text-muted mt-1">
                <span>Generating...</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
            </div>
          )}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            leftIcon={<Wand2 className="w-4 h-4" />}
            loading={generating}
            onClick={handleGenerate}
          >
            {generating ? 'Generating...' : 'Generate'}
          </Button>
        </div>
      </div>

      {/* Right: Preview area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="panel-header">
          Preview
        </div>

        {/* Main preview */}
        <div className="flex-1 flex items-center justify-center bg-studio-bg overflow-hidden p-4">
          {selectedImage ? (
            <img
              src={`asset://localhost/${selectedImage}`}
              alt="Generated"
              className="max-w-full max-h-full object-contain rounded"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-studio-text-muted">
              <Image className="w-16 h-16 opacity-20" />
              <span className="text-sm">Generate an image to preview it here</span>
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {generatedImages.length > 1 && (
          <div className="flex gap-2 p-3 border-t border-studio-border overflow-x-auto">
            {generatedImages.map((img, i) => (
              <button
                key={i}
                onClick={() => setSelectedImage(img)}
                className={clsx(
                  'w-16 h-16 flex-shrink-0 rounded overflow-hidden border-2 transition-all',
                  selectedImage === img ? 'border-studio-accent' : 'border-transparent'
                )}
              >
                <img src={`asset://localhost/${img}`} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Action bar */}
        {selectedImage && (
          <div className="flex items-center gap-2 px-4 py-2 border-t border-studio-border">
            <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>
              Save
            </Button>
            <Button variant="secondary" size="sm" leftIcon={<Copy className="w-3.5 h-3.5" />}>
              Copy
            </Button>
            <div className="flex-1" />
            {params.width > 0 && (
              <span className="text-xs text-studio-text-muted">{params.width}×{params.height}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SliderParam({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-studio-text">{label}</label>
        <span className="text-xs text-studio-text-muted">{value}</span>
      </div>
      <Slider.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => v !== undefined && onChange(v)}
        className="relative flex items-center h-4"
      >
        <Slider.Track className="flex-1 h-1 rounded-full bg-studio-border">
          <Slider.Range className="absolute h-full rounded-full bg-studio-accent" />
        </Slider.Track>
        <Slider.Thumb className="block w-3.5 h-3.5 rounded-full bg-white border-2 border-studio-accent shadow focus:outline-none focus:ring-2 focus:ring-studio-accent" />
      </Slider.Root>
    </div>
  );
}
