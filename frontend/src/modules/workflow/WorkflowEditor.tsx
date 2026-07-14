import { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type NodeTypes,
  ReactFlowProvider,
  Panel,
  BackgroundVariant,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { GitBranch, Plus, Save, Play, X } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflow.store';
import { useModelStore } from '@/stores/model.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { generateId } from '@/utils/helpers';
import { WorkflowNodeComponent } from './WorkflowNode';
import { NODE_REGISTRY } from './NodeRegistry';
import { clsx } from 'clsx';

const NODE_TYPES: NodeTypes = {
  workflowNode: WorkflowNodeComponent,
};

export default function WorkflowEditor() {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner />
    </ReactFlowProvider>
  );
}

function WorkflowEditorInner() {
  const {
    activeWorkflow, isDirty,
    createWorkflow, saveWorkflow, executeWorkflow,
    addNode, addEdge: storeAddEdge,
    updateNodePosition, updateNodeParam,
  } = useWorkflowStore();

  const installedModels = useModelStore((s) => s.models.filter((m) => m.installed === 1));

  const [nodes, setNodes, onNodesChange] = useNodesState(activeWorkflow?.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(activeWorkflow?.edges ?? []);
  const [showNewModal, setShowNewModal] = useState(!activeWorkflow);
  const [newName, setNewName] = useState('');
  const [showNodePicker, setShowNodePicker] = useState(false);
  const [nodePickerPos, setNodePickerPos] = useState({ x: 40, y: 40 });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Sync store workflow to React Flow state
  useEffect(() => {
    if (activeWorkflow) {
      setNodes(activeWorkflow.nodes as Parameters<typeof setNodes>[0]);
      setEdges(activeWorkflow.edges as Parameters<typeof setEdges>[0]);
    }
  }, [activeWorkflow?.id]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const edge = {
        ...connection,
        id: generateId(),
        animated: true,
      };
      setEdges((eds) => addEdge(edge, eds));
      if (connection.source && connection.target && connection.sourceHandle && connection.targetHandle) {
        storeAddEdge({
          id: edge.id,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle!,
          targetHandle: connection.targetHandle!,
          animated: true,
        });
      }
    },
    [setEdges, storeAddEdge]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: { id: string; position: { x: number; y: number } }) => {
      updateNodePosition(node.id, node.position);
    },
    [updateNodePosition]
  );

  const handleAddNode = (nodeTypeId: string) => {
    const definition = NODE_REGISTRY[nodeTypeId];
    if (!definition) return;

    const newNode = {
      id: generateId(),
      type: 'workflowNode',
      position: { x: nodePickerPos.x + Math.random() * 40, y: nodePickerPos.y + Math.random() * 40 },
      data: {
        metadata: definition.metadata,
        inputs: definition.inputs,
        outputs: definition.outputs,
        params: Object.fromEntries(
          definition.inputs
            .filter((i) => i.default !== undefined)
            .map((i) => [i.id, i.default])
        ),
      },
    };

    setNodes((nds) => [...nds, newNode as Parameters<typeof setNodes>[0][0]]);
    addNode(newNode as Parameters<typeof addNode>[0]);
    setShowNodePicker(false);
  };

  const onPaneDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setNodePickerPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setShowNodePicker(true);
    },
    []
  );

  const openNodePickerCentered = useCallback(() => {
    setNodePickerPos({ x: 40, y: 40 });
    setShowNodePicker(true);
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const handleParamChange = (nodeId: string, key: string, value: unknown) => {
    updateNodeParam(nodeId, key, value);
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, params: { ...n.data.params, [key]: value } } }
          : n
      )
    );
    if (selectedNode?.id === nodeId) {
      setSelectedNode((prev) =>
        prev ? { ...prev, data: { ...prev.data, params: { ...prev.data.params, [key]: value } } } : prev
      );
    }
  };

  const handleSave = async () => {
    // Sync current RF state back to store before saving
    await saveWorkflow();
  };

  const handleExecute = async () => {
    await executeWorkflow();
  };

  const nodeCategories = Object.entries(
    Object.entries(NODE_REGISTRY).reduce((acc, [id, def]) => {
      const cat = def.metadata.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push({ id, ...def });
      return acc;
    }, {} as Record<string, Array<{ id: string; metadata: (typeof NODE_REGISTRY)[string]['metadata'] }>>)
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-studio-border bg-studio-panel">
        <GitBranch className="w-4 h-4 text-studio-accent" />
        <h1 className="text-sm font-semibold text-studio-text">
          {activeWorkflow?.name ?? 'Workflow Editor'}
          {isDirty && <span className="text-studio-text-muted ml-1">•</span>}
        </h1>
        <div className="flex-1" />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowNewModal(true)}>
            New
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={openNodePickerCentered}
            disabled={!activeWorkflow}
          >
            Add Node
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Save className="w-3.5 h-3.5" />}
            onClick={handleSave}
            disabled={!activeWorkflow || !isDirty}
          >
            Save
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Play className="w-3.5 h-3.5" />}
            onClick={handleExecute}
            disabled={!activeWorkflow}
          >
            Run
          </Button>
        </div>
      </div>

      {/* React Flow canvas + optional node inspector */}
      <div className="flex-1 flex overflow-hidden">
        <div className={clsx('flex-1 relative', selectedNode && 'border-r border-studio-border')}>
          {activeWorkflow ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={onNodeClick}
            onPaneClick={() => { setShowNodePicker(false); setSelectedNode(null); }}
            onDoubleClick={onPaneDoubleClick}
            nodeTypes={NODE_TYPES}
            fitView
            deleteKeyCode="Delete"
            zoomOnDoubleClick={false}
            className="bg-studio-bg"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1.5}
              color="#3a3a40"
            />
            <Controls className="!bg-studio-surface !border-studio-border !text-studio-text" />
            <MiniMap
              className="!bg-studio-surface !border-studio-border"
              nodeColor="#7c3aed"
              maskColor="rgba(0,0,0,0.6)"
            />

            {/* Empty canvas hint */}
            {nodes.length === 0 && (
              <Panel position="top-center">
                <div className="mt-8 px-4 py-2 rounded-lg bg-studio-surface/80 border border-studio-border text-xs text-studio-text-muted text-center backdrop-blur-sm">
                  Click <strong className="text-studio-text">Add Node</strong> in the toolbar, or double-click anywhere on the canvas
                </div>
              </Panel>
            )}

            {/* Node picker dropdown */}
            {showNodePicker && (
              <Panel position="top-left" style={{ left: nodePickerPos.x, top: nodePickerPos.y }}>
                <div className="bg-studio-surface border border-studio-border rounded-lg shadow-dropdown w-56 max-h-80 overflow-y-auto">
                  <div className="px-3 py-2 border-b border-studio-border text-xs font-semibold text-studio-text-muted">
                    Add Node
                  </div>
                  {nodeCategories.map(([category, items]) => (
                    <div key={category}>
                      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-studio-text-muted bg-studio-bg/50">
                        {category}
                      </div>
                      {items.map((item) => (
                        <button
                          key={item.id}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-studio-text hover:bg-studio-accent/10 hover:text-studio-accent-light transition-colors"
                          onClick={() => handleAddNode(item.id)}
                        >
                          <span>{item.metadata.name}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </ReactFlow>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <GitBranch className="w-16 h-16 text-studio-text-muted/30" />
            <p className="text-studio-text-muted text-sm">No workflow open</p>
            <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowNewModal(true)}>
              Create Workflow
            </Button>
          </div>
        )}
        </div>

        {/* Node Properties Inspector */}
        {selectedNode && (
          <div className="w-64 flex-shrink-0 flex flex-col bg-studio-panel overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-studio-border">
              <span className="text-xs font-semibold text-studio-text-muted uppercase tracking-wider">
                Node Properties
              </span>
              <button onClick={() => setSelectedNode(null)} className="text-studio-text-muted hover:text-studio-text">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-3 flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium text-studio-text">{(selectedNode.data as { metadata?: { name?: string } }).metadata?.name ?? selectedNode.type}</p>
                <p className="text-xs text-studio-text-muted">{(selectedNode.data as { metadata?: { category?: string } }).metadata?.category}</p>
              </div>
              {Object.entries((selectedNode.data as { params?: Record<string, unknown> }).params ?? {}).map(([key, val]) => {
                const isModelParam = key === 'model_id' || key === 'model';
                return (
                  <div key={key} className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-studio-text-muted uppercase tracking-wider">
                      {key.replace(/_/g, ' ')}
                    </label>
                    {isModelParam ? (
                      <select
                        value={String(val ?? '')}
                        onChange={(e) => handleParamChange(selectedNode.id, key, e.target.value)}
                        className="h-7 px-2 text-xs rounded bg-studio-bg border border-studio-border text-studio-text focus:outline-none focus:border-studio-accent"
                      >
                        <option value="">— select model —</option>
                        {installedModels.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    ) : typeof val === 'boolean' ? (
                      <input
                        type="checkbox"
                        checked={!!val}
                        onChange={(e) => handleParamChange(selectedNode.id, key, e.target.checked)}
                        className="w-4 h-4 accent-studio-accent"
                      />
                    ) : typeof val === 'number' ? (
                      <input
                        type="number"
                        value={val}
                        onChange={(e) => handleParamChange(selectedNode.id, key, Number(e.target.value))}
                        className="h-7 px-2 text-xs rounded bg-studio-bg border border-studio-border text-studio-text focus:outline-none focus:border-studio-accent w-full"
                      />
                    ) : (
                      <input
                        type="text"
                        value={String(val ?? '')}
                        onChange={(e) => handleParamChange(selectedNode.id, key, e.target.value)}
                        className="h-7 px-2 text-xs rounded bg-studio-bg border border-studio-border text-studio-text focus:outline-none focus:border-studio-accent w-full"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* New workflow modal */}
      <Modal
        open={showNewModal && !activeWorkflow}
        onClose={() => setShowNewModal(false)}
        title="New Workflow"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNewModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => { createWorkflow(newName || 'Untitled Workflow'); setShowNewModal(false); setNewName(''); }}
            >
              Create
            </Button>
          </>
        }
      >
        <Input
          label="Workflow Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="My Workflow"
          autoFocus
        />
      </Modal>
    </div>
  );
}
