import { createContext, useContext } from 'react';
import { useQuickCapture } from '@/hooks/use-quick-capture';
import { QuickCaptureDialog } from '@/components/quick-capture-dialog';

interface QuickCaptureContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const QuickCaptureContext = createContext<QuickCaptureContextValue | null>(null);

export function useQuickCaptureContext() {
  const ctx = useContext(QuickCaptureContext);
  if (!ctx) throw new Error('useQuickCaptureContext must be used within QuickCaptureProvider');
  return ctx;
}

export function QuickCaptureProvider({ children }: { children: React.ReactNode }) {
  const quickCapture = useQuickCapture();

  return (
    <QuickCaptureContext.Provider value={quickCapture}>
      {children}
      <QuickCaptureDialog />
    </QuickCaptureContext.Provider>
  );
}
