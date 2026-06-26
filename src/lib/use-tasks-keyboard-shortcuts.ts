import { useEffect, useRef } from 'react';
import { isInputFocused } from './keyboard-utils';

interface TasksShortcutsOpts {
  taskIds: string[];
  highlightedId: string | null;
  setHighlightedId: (id: string | null) => void;
  onExpand: (id: string) => void;
  onEdit: (id: string) => void;
  onStatusCycle: (id: string) => void;
  onSetPriority: (id: string, priority: number) => void;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewTask: () => void;
  onFocusSearch: () => void;
}

/**
 * Keyboard shortcuts for the Tasks page.
 *
 * When no input is focused:
 *   j / ↓  — highlight next task
 *   k / ↑  — highlight previous task
 *   Enter  — expand / collapse highlighted task
 *   e      — edit highlighted task
 *   s      — cycle status (backlog→todo→doing→done→archived)
 *   1-4    — set priority (1=Urgent … 4=Low)
 *   x      — toggle selection
 *   # / Delete — delete highlighted task
 *   n      — new task dialog
 *   /      — focus search box
 */
export function useTasksKeyboardShortcuts(opts: TasksShortcutsOpts) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return;
      const {
        taskIds, highlightedId, setHighlightedId,
        onExpand, onEdit, onStatusCycle, onSetPriority,
        onToggleSelect, onDelete, onNewTask, onFocusSearch,
      } = optsRef.current;

      const idx = highlightedId ? taskIds.indexOf(highlightedId) : -1;

      switch (e.key) {
        case 'j':
        case 'ArrowDown': {
          e.preventDefault();
          const next = idx < taskIds.length - 1 ? idx + 1 : 0;
          setHighlightedId(taskIds[next] ?? null);
          scrollTaskIntoView(taskIds[next]);
          break;
        }
        case 'k':
        case 'ArrowUp': {
          e.preventDefault();
          const prev = idx > 0 ? idx - 1 : taskIds.length - 1;
          setHighlightedId(taskIds[prev] ?? null);
          scrollTaskIntoView(taskIds[prev]);
          break;
        }
        case 'Enter': {
          if (highlightedId) { e.preventDefault(); onExpand(highlightedId); }
          break;
        }
        case 'e': {
          if (highlightedId) { e.preventDefault(); onEdit(highlightedId); }
          break;
        }
        case 's': {
          if (highlightedId) { e.preventDefault(); onStatusCycle(highlightedId); }
          break;
        }
        case '1': case '2': case '3': case '4': {
          if (highlightedId) { e.preventDefault(); onSetPriority(highlightedId, Number(e.key)); }
          break;
        }
        case 'x': {
          if (highlightedId) { e.preventDefault(); onToggleSelect(highlightedId); }
          break;
        }
        case '#':
        case 'Delete':
        case 'Backspace': {
          if (highlightedId) { e.preventDefault(); onDelete(highlightedId); }
          break;
        }
        case 'n': {
          e.preventDefault();
          onNewTask();
          break;
        }
        case '/': {
          e.preventDefault();
          onFocusSearch();
          break;
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}

function scrollTaskIntoView(id: string | undefined) {
  if (!id) return;
  const el = document.querySelector(`[data-task-id="${id}"]`);
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
