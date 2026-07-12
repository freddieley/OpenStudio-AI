import { Film } from 'lucide-react';

export default function VideoStudioImpl() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 text-studio-text-muted">
      <Film className="w-16 h-16 opacity-20" />
      <h2 className="text-lg font-semibold text-studio-text">Video Studio</h2>
      <p className="text-sm max-w-sm text-center">
        AI-powered video generation, frame interpolation, lip-sync, and editing tools.
        Connect video generation models in the Model Manager to get started.
      </p>
    </div>
  );
}
