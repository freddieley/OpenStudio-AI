import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { clsx } from 'clsx';
import type { PortDefinition } from '@/types';

const PORT_COLORS: Record<string, string> = {
  image: 'bg-purple-500',
  video: 'bg-blue-500',
  audio: 'bg-green-500',
  text: 'bg-yellow-500',
  number: 'bg-orange-500',
  boolean: 'bg-red-500',
  model: 'bg-pink-500',
  latent: 'bg-violet-500',
  conditioning: 'bg-cyan-500',
  mask: 'bg-gray-500',
  any: 'bg-studio-text-muted',
  object: 'bg-teal-500',
  array: 'bg-indigo-500',
};

interface NodeData {
  metadata: {
    name: string;
    category: string;
    description: string;
    color?: string;
  };
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  params: Record<string, unknown>;
  label?: string;
}

export const WorkflowNodeComponent = memo(function WorkflowNodeComponent({
  data,
  selected,
}: NodeProps<NodeData>) {
  const { metadata, inputs, outputs } = data;
  const headerColor = metadata.color ?? '#7c3aed';

  return (
    <div
      className={clsx(
        'min-w-[180px] rounded-lg border overflow-hidden',
        'bg-studio-surface shadow-panel',
        selected ? 'border-studio-accent' : 'border-studio-border'
      )}
    >
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: `${headerColor}22` }}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: headerColor }}
        />
        <span className="text-xs font-semibold text-studio-text truncate">
          {data.label ?? metadata.name}
        </span>
        <span className="text-[10px] text-studio-text-muted ml-auto">{metadata.category}</span>
      </div>

      {/* Ports */}
      <div className="flex gap-8 px-2 py-2">
        {/* Inputs */}
        <div className="flex flex-col gap-2 flex-1">
          {inputs.map((port, i) => (
            <div key={port.id} className="relative flex items-center gap-1.5">
              <Handle
                type="target"
                position={Position.Left}
                id={port.id}
                style={{
                  left: -8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 10,
                  height: 10,
                  border: '2px solid #2a2a2e',
                }}
                className={clsx('rounded-full', PORT_COLORS[port.type] ?? 'bg-studio-muted')}
              />
              <span className="text-[10px] text-studio-text-muted truncate max-w-[80px]">
                {port.name}
                {port.required && <span className="text-studio-error ml-0.5">*</span>}
              </span>
            </div>
          ))}
        </div>

        {/* Outputs */}
        <div className="flex flex-col gap-2 items-end flex-1">
          {outputs.map((port) => (
            <div key={port.id} className="relative flex items-center gap-1.5">
              <span className="text-[10px] text-studio-text-muted truncate max-w-[80px] text-right">
                {port.name}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={port.id}
                style={{
                  right: -8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 10,
                  height: 10,
                  border: '2px solid #2a2a2e',
                }}
                className={clsx('rounded-full', PORT_COLORS[port.type] ?? 'bg-studio-muted')}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
