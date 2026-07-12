import { Layers } from 'lucide-react';

export default function TimelineEditor() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-studio-text-muted">
      <Layers className="w-16 h-16 opacity-20" />
      <h2 className="text-lg font-semibold text-studio-text">Timeline Editor</h2>
      <p className="text-sm max-w-sm text-center">
        Sequence, trim, and arrange your AI-generated assets on a timeline.
        Open a project to start editing.
      </p>
    </div>
  );
}
