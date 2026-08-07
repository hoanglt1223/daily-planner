/* PWA utilities for install prompt and offline detection */

export interface PWAPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: PWAPromptEvent | null = null;
let isOffline = !navigator.onLine;
const listeners = new Set<(online: boolean) => void>();

export function initPWA() {
  // Track online/offline status
  window.addEventListener('online', () => {
    isOffline = false;
    notifyListeners(false);
  });

  window.addEventListener('offline', () => {
    isOffline = true;
    notifyListeners(true);
  });

  // Listen for install prompt
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as PWAPromptEvent;
  });

  // Track if app was successfully installed
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
  });
}

export function canInstallPWA(): boolean {
  return deferredPrompt !== null;
}

export async function promptPWAInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  if (outcome === 'accepted') {
    deferredPrompt = null;
    return true;
  }

  deferredPrompt = null;
  return false;
}

export function isAppOffline(): boolean {
  return isOffline;
}

export function subscribeToOnlineStatus(callback: (online: boolean) => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners(offline: boolean) {
  listeners.forEach((cb) => cb(!offline));
}

export function isIOSDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export function shouldShowIOSInstallPrompt(): boolean {
  return isIOSDevice() && !isStandalone();
}
