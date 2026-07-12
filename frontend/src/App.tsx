import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from '@/stores/app.store';
import { useJobStore } from '@/stores/job.store';
import AppLayout from '@/components/layout/AppLayout';
import { ToastProvider } from '@/components/ui/Toast';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import Dashboard from '@/modules/dashboard/Dashboard';
import ProjectManager from '@/modules/project/ProjectManager';
import ModelManager from '@/modules/model/ModelManager';
import WorkflowEditor from '@/modules/workflow/WorkflowEditor';
import ImageGenerator from '@/modules/image/ImageGenerator';
import VideoStudio from '@/modules/video/VideoStudio';
import VoiceStudio from '@/modules/audio/VoiceStudio';
import TimelineEditor from '@/modules/timeline/TimelineEditor';
import AssetBrowser from '@/modules/assets/AssetBrowser';
import JobQueue from '@/modules/jobs/JobQueue';
import PluginManager from '@/modules/plugins/PluginManager';
import SettingsPage from '@/modules/settings/Settings';
import ExportManager from '@/modules/export/ExportManager';

export default function App() {
  const initialize = useAppStore((s) => s.initialize);
  const settings = useAppStore((s) => s.settings);
  const startPolling = useJobStore((s) => s.startPolling);
  const stopPolling = useJobStore((s) => s.stopPolling);

  useEffect(() => {
    initialize();
    startPolling(3000);
    return () => stopPolling();
  }, [initialize, startPolling, stopPolling]);

  // Apply theme class to document root
  useEffect(() => {
    const theme = settings?.theme ?? 'dark';
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings?.theme]);

  useKeyboardShortcuts();

  return (
    <ToastProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<ProjectManager />} />
          <Route path="/models" element={<ModelManager />} />
          <Route path="/workflows" element={<WorkflowEditor />} />
          <Route path="/workflows/:id" element={<WorkflowEditor />} />
          <Route path="/image" element={<ImageGenerator />} />
          <Route path="/video" element={<VideoStudio />} />
          <Route path="/voice" element={<VoiceStudio />} />
          <Route path="/timeline" element={<TimelineEditor />} />
          <Route path="/assets" element={<AssetBrowser />} />
          <Route path="/jobs" element={<JobQueue />} />
          <Route path="/plugins" element={<PluginManager />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/export" element={<ExportManager />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppLayout>
      <CommandPalette />
    </ToastProvider>
  );
}
