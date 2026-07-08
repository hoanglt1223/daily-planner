import { useCallback, useEffect, useState } from 'react';

interface QuickCaptureState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export function useQuickCapture(): QuickCaptureState {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(v => !v), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open quick capture
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggle, close]);

  return { isOpen, open, close, toggle };
}
