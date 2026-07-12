import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from '@/stores/app.store';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core');
const mockInvoke = vi.mocked(invoke);

describe('useAppStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds and removes toasts', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.addToast({
        type: 'success',
        title: 'Test toast',
        duration: 0, // don't auto-remove
      });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.title).toBe('Test toast');

    const id = result.current.toasts[0]!.id;
    act(() => {
      result.current.removeToast(id);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('opens and closes command palette', () => {
    const { result } = renderHook(() => useAppStore());

    expect(result.current.commandPaletteOpen).toBe(false);

    act(() => {
      result.current.openCommandPalette();
    });

    expect(result.current.commandPaletteOpen).toBe(true);

    act(() => {
      result.current.closeCommandPalette();
    });

    expect(result.current.commandPaletteOpen).toBe(false);
  });

  it('toggles sidebar', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.setSidebarCollapsed(true);
    });

    expect(result.current.sidebarCollapsed).toBe(true);

    act(() => {
      result.current.setSidebarCollapsed(false);
    });

    expect(result.current.sidebarCollapsed).toBe(false);
  });
});
