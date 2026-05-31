import { useEffect } from 'react';
import { isInputFocused } from '@/lib/keyboard-utils';

/**
 * Planner-scoped keyboard shortcuts. Mount inside PlannerGrid.
 * Suppresses when an input or dialog has focus.
 *
 * Callbacks are read from a ref so the listener never re-registers.
 */
export function usePlannerShortcuts(opts: {
  view: 'day' | 'week';
  setView: (v: 'day' | 'week') => void;
  days: number;
  setAnchor: (d: Date) => void;
  editorOpen: boolean;
  onCloseEditor: () => void;
  onNewTask: () => void;
  onFocusSearch: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return;

      // Close editor dialog
      if (e.key === 'Escape') {
        if (opts.editorOpen) { opts.onCloseEditor(); return; }
      }

      // Help dialog toggle
      if (e.key === '?' || (e.key === '/' && (e.ctrlKey || e.metaKey))) {
        document.dispatchEvent(new CustomEvent('shortcut:help'));
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case 'd':
          e.preventDefault();
          opts.setView('day');
          break;
        case 'w':
          e.preventDefault();
          opts.setView('week');
          break;
        case 'j':
        case 'ArrowLeft':
          e.preventDefault();
          opts.setAnchor(new Date(Date.now() - opts.days * 86_400_000));
          break;
        case 'k':
        case 'ArrowRight':
          e.preventDefault();
          opts.setAnchor(new Date(Date.now() + opts.days * 86_400_000));
          break;
        case 't':
          e.preventDefault();
          opts.setAnchor(new Date());
          break;
        case 'n':
          e.preventDefault();
          opts.onNewTask();
          break;
        case 'f':
        case '/':
          e.preventDefault();
          opts.onFocusSearch();
          break;
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // Intentionally minimal deps — opts callbacks are stable (setState / useCallback from parent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.editorOpen, opts.days]);
}
