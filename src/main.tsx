import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { QuickCaptureProvider } from '@/components/quick-capture-provider';
import { MusicControlProvider } from '@/lib/music-control.tsx';
import { router } from '@/router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MusicControlProvider>
        <QuickCaptureProvider>
          <RouterProvider router={router} />
        </QuickCaptureProvider>
        <Toaster richColors position="top-right" />
      </MusicControlProvider>
    </ThemeProvider>
  </StrictMode>,
);
