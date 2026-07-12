import { Download } from 'lucide-react';

export default function ExportManager() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-studio-text-muted">
      <Download className="w-16 h-16 opacity-20" />
      <h2 className="text-lg font-semibold text-studio-text">Export Manager</h2>
      <p className="text-sm max-w-sm text-center">
        Export your projects, timelines, and assets in various formats.
        Open a project with content to begin exporting.
      </p>
    </div>
  );
}
