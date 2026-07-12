import { useEffect, useState } from 'react';
import { FolderOpen, Plus, Trash2, ExternalLink, Search, Calendar, MoreHorizontal } from 'lucide-react';
import { useProjectStore } from '@/stores/project.store';
import { useAppStore } from '@/stores/app.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { formatDate } from '@/utils/helpers';
import type { CreateProjectInput } from '@/types';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

export default function ProjectManager() {
  const { projects, loading, loadProjects, createProject, openProject, deleteProject } = useProjectStore();
  const addToast = useAppStore((s) => s.addToast);

  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [form, setForm] = useState<CreateProjectInput>({ name: '', description: '', path: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleBrowsePath = async () => {
    const selected = await openDialog({ directory: true, multiple: false, title: 'Select Project Folder' });
    if (typeof selected === 'string') {
      setForm((f) => ({ ...f, path: selected }));
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { addToast({ type: 'error', title: 'Project name is required' }); return; }
    if (!form.path.trim()) { addToast({ type: 'error', title: 'Project path is required' }); return; }
    setCreating(true);
    try {
      const project = await createProject(form);
      await openProject(project.id);
      setShowCreateModal(false);
      setForm({ name: '', description: '', path: '' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    setShowDeleteModal(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-studio-border">
        <FolderOpen className="w-5 h-5 text-studio-accent" />
        <h1 className="text-base font-semibold text-studio-text flex-1">Projects</h1>
        <div className="w-56">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            leftAddon={<Search className="w-3.5 h-3.5" />}
          />
        </div>
        <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreateModal(true)}>
          New Project
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-40 rounded-lg shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <FolderOpen className="w-12 h-12 text-studio-text-muted" />
            <p className="text-studio-text-muted text-sm">
              {search ? 'No projects match your search' : 'No projects yet'}
            </p>
            {!search && (
              <Button variant="primary" onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="w-4 h-4" />}>
                Create Your First Project
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((project) => (
              <div
                key={project.id}
                className="group relative flex flex-col rounded-lg bg-studio-surface border border-studio-border hover:border-studio-accent/40 transition-all overflow-hidden cursor-pointer"
                onClick={() => openProject(project.id)}
              >
                {/* Thumbnail */}
                <div className="h-32 bg-gradient-to-br from-studio-accent/20 to-studio-bg flex items-center justify-center">
                  {project.thumbnail ? (
                    <img src={project.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <FolderOpen className="w-10 h-10 text-studio-accent/40" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 p-3">
                  <h3 className="text-sm font-medium text-studio-text truncate">{project.name}</h3>
                  {project.description && (
                    <p className="text-xs text-studio-text-muted mt-0.5 line-clamp-2">{project.description}</p>
                  )}
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-studio-text-muted">
                    <Calendar className="w-3 h-3" />
                    {formatDate(project.updated_at)}
                  </div>
                </div>

                {/* Actions (hover) */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); }}
                    className="p-1 rounded bg-studio-bg/80 text-studio-text-muted hover:text-studio-text hover:bg-studio-bg"
                    title="Open folder"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowDeleteModal(project.id); }}
                    className="p-1 rounded bg-studio-bg/80 text-studio-text-muted hover:text-studio-error hover:bg-studio-bg"
                    title="Delete project"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Project"
        description="Set up a new OpenStudio AI project"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" loading={creating} onClick={handleCreate}>Create Project</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Project Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="My AI Project"
            autoFocus
          />
          <Input
            label="Description (optional)"
            value={form.description ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Describe your project..."
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-studio-text">Project Location</label>
            <div className="flex gap-2">
              <Input
                value={form.path}
                onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
                placeholder="C:\Users\...\Projects\MyProject"
                className="flex-1"
              />
              <Button variant="secondary" onClick={handleBrowsePath}>Browse</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={!!showDeleteModal}
        onClose={() => setShowDeleteModal(null)}
        title="Delete Project"
        description="This will remove the project from OpenStudio AI. Your files on disk will not be deleted."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDeleteModal(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => showDeleteModal && handleDelete(showDeleteModal)}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-studio-text-muted">
          Are you sure you want to delete this project? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
