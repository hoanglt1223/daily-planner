import { useEffect, useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  canInstallPWA,
  promptPWAInstall,
  subscribeToOnlineStatus,
  shouldShowIOSInstallPrompt,
} from '@/lib/pwa-utils';

export function PWAInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);
  const [offline, setOffline] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkInstallable = () => setCanInstall(canInstallPWA());
    checkInstallable();

    const unsub = subscribeToOnlineStatus((online) => {
      setOffline(!online);
    });

    const interval = setInterval(checkInstallable, 3000);

    if (shouldShowIOSInstallPrompt()) {
      setShowIOSPrompt(true);
    }

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  if (dismissed) return null;

  const handleInstall = async () => {
    const accepted = await promptPWAInstall();
    if (accepted) {
      setCanInstall(false);
      setDismissed(true);
    }
  };

  if (offline) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-200 dark:border-amber-800 px-4 py-2">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <WifiOff className="size-4 text-amber-600" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              You're offline. Some features may be limited.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-600 hover:text-amber-800"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  if (showIOSPrompt) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-indigo-50 dark:bg-indigo-950/20 border-t border-indigo-200 dark:border-indigo-800 px-4 py-3">
        <div className="flex items-start justify-between gap-3 max-w-7xl mx-auto">
          <div className="flex-1">
            <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100 mb-1">
              Install Daily Planner
            </p>
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              Tap the share button <span className="font-semibold">⎯</span> and select
              <span className="font-semibold"> "Add to Home Screen"</span>
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-indigo-600 hover:text-indigo-800"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!canInstall) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
            <Download className="size-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              Install Daily Planner
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              Get app-like experience with offline support
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleInstall} className="h-7">
                Install
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDismissed(true)}
                className="h-7"
              >
                Not now
              </Button>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
