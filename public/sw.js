const CACHE_NAME = 'daily-planner-v1';
const STATIC_CACHE = 'daily-planner-static-v1';
const API_CACHE = 'daily-planner-api-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/vite.svg',
  '/manifest.json',
];

const CACHE_STRATEGIES = {
  // Cache-first for static assets
  static: async (request) => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    const network = await fetch(request);
    if (network.ok) {
      cache.put(request, network.clone());
    }
    return network;
  },

  // Network-first for API with cache fallback
  api: async (request) => {
    const cache = await caches.open(API_CACHE);

    try {
      const network = await fetch(request);
      if (network.ok) {
        cache.put(request, network.clone());
      }
      return network;
    } catch {
      const cached = await cache.match(request);
      if (cached) return cached;
      throw new Error('Network unavailable and no cache');
    }
  },
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== API_CACHE) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and chrome/extensions
  if (
    event.request.method !== 'GET' ||
    !url.protocol.startsWith('http') ||
    url.origin === 'chrome-extension://' ||
    url.hostname.includes('extension')
  ) {
    return;
  }

  // API routes: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(CACHE_STRATEGIES.api(event.request));
    return;
  }

  // Static assets: cache-first
  event.respondWith(CACHE_STRATEGIES.static(event.request));
});
