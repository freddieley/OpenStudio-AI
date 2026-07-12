import { useEffect } from 'react';
import { useAppStore } from '@/stores/app.store';
import { useNavigate } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const openCommandPalette = useAppStore((s) => s.openCommandPalette);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement;
      const isEditing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // ─── Global shortcuts (always active) ────────────────────────────
      // Cmd/Ctrl + K → command palette
      if (ctrl && e.key === 'k') {
        e.preventDefault();
        openCommandPalette();
        return;
      }

      // ─── Non-editing shortcuts ────────────────────────────────────────
      if (isEditing) return;

      // Cmd/Ctrl + , → settings
      if (ctrl && e.key === ',') {
        e.preventDefault();
        navigate('/settings');
        return;
      }

      // Cmd/Ctrl + N → new project (handled by ProjectManager)
      // Cmd/Ctrl + S → save (handled contextually)
      // Cmd/Ctrl + Z → undo (handled contextually)
      // Cmd/Ctrl + Shift + Z → redo (handled contextually)

      // Number shortcuts to switch tabs
      if (!ctrl && !e.altKey && !e.shiftKey) {
        switch (e.key) {
          case '1': navigate('/dashboard'); break;
          case '2': navigate('/projects'); break;
          case '3': navigate('/image'); break;
          case '4': navigate('/video'); break;
          case '5': navigate('/workflows'); break;
        }
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [openCommandPalette, navigate]);
}
