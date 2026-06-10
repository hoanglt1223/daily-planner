import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isInputFocused } from './keyboard-utils';

const CHORD_TIMEOUT = 800;

/**
 * Global keyboard shortcuts: nav chords (g+d, g+p, g+m), Escape to close dialogs,
 * ? or Ctrl+/ to toggle help dialog, n for quick task capture.
 * Mount once in AppLayout.
 */
export function useGlobalShortcuts() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const chordRef = useRef<string | null>(null);
  const chordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Escape: close any open dialog
      if (e.key === 'Escape') {
        document.dispatchEvent(new CustomEvent('shortcut:close-dialogs'));
        return;
      }

      // ? or Ctrl+/: toggle help
      if (e.key === '?' || (e.key === '/' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('shortcut:help'));
        return;
      }

      if (isInputFocused()) return;

      // n: quick task capture (skip on /planner — it has its own n handler)
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && !pathname.startsWith('/planner')) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('shortcut:quick-task'));
        return;
      }

      // l: quick time log
      if (e.key === 'l' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('shortcut:quick-time-log'));
        return;
      }

      // Chord handling: g prefix
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        chordRef.current = 'g';
        if (chordTimer.current) clearTimeout(chordTimer.current);
        chordTimer.current = setTimeout(() => { chordRef.current = null; }, CHORD_TIMEOUT);
        return;
      }

      // Second key of chord
      if (chordRef.current === 'g') {
        chordRef.current = null;
        if (chordTimer.current) { clearTimeout(chordTimer.current); chordTimer.current = null; }
        const routes: Record<string, string> = { d: '/dashboard', p: '/planner', m: '/manager' };
        if (routes[e.key]) { e.preventDefault(); nav(routes[e.key]); }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (chordTimer.current) clearTimeout(chordTimer.current);
    };
  }, [nav, pathname]);
}
