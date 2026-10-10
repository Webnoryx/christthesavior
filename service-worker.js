
const CACHE_VERSION = 'cts-songbook-v3';

const CACHE_FILES = [
  './',
  './index.html',
  './songs.js?v=1001',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-icon.png'
];

// Install the new version
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      await Promise.all(
        CACHE_FILES.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (error) {
            console.warn('Could not cache:', url, error);
          }
        })
      );

      await self.skipWaiting();
    })
  );
});

// Remove old versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter((key) =>
            key.startsWith('cts-songbook-') &&
            key !== CACHE_VERSION
          )
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

// Network-first for HTML and songs; cache-first for other assets
self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isLocal = url.origin === self.location.origin;

  const isImportantFile =
    isLocal &&
    (
      url.pathname.endsWith('/index.html') ||
      url.pathname.endsWith('/songs.js') ||
      url.pathname.endsWith('/')
    );

  if (isImportantFile) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request, {
            cache: 'no-cache'
          });

          if (response.ok) {
            const cache = await caches.open(CACHE_VERSION);
            await cache.put(request, response.clone());
          }

          return response;
        } catch (error) {
          const cached = await caches.match(request);

          if (cached) return cached;

          if (request.mode === 'navigate') {
            return (
              await caches.match('./index.html')
            ) || Response.error();
          }

          return Response.error();
        }
      })()
    );

    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);

        if (response.ok && response.status === 200) {
          const cache = await caches.open(CACHE_VERSION);
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        return Response.error();
      }
    })()
  );
});
