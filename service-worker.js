
const CACHE_VERSION = 'cts-songbook-v4';

const CACHE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-icon.png'
];

// Install the new service worker immediately.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);

    await Promise.all(
      CACHE_FILES.map(async (file) => {
        try {
          const response = await fetch(file, { cache: 'reload' });
          if (response.ok) {
            await cache.put(file, response);
          }
        } catch (error) {
          console.warn('Could not cache:', file, error);
        }
      })
    );

    await self.skipWaiting();
  })());
});

// Remove old caches and activate the new worker.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key =>
          key.startsWith('cts-songbook-') &&
          key !== CACHE_VERSION
        )
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

// Always try the internet first for HTML and songs.
self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  const isHTML = request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html');

  const isSongs = url.pathname.endsWith('/songs.js');

  if (isHTML || isSongs) {
    event.respondWith((async () => {
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

        // Offline fallback for older cached song URLs.
        if (isSongs) {
          const oldSongs = await caches.match(request, {
            ignoreSearch: true
          });

          if (oldSongs) return oldSongs;
        }

        if (isHTML) {
          const offlinePage = await caches.match(
            new URL('./index.html', self.registration.scope).href
          );

          if (offlinePage) return offlinePage;
        }

        return new Response('Offline', { status: 503 });
      }
    })());

    return;
  }

  // Keep other assets cached for offline use.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);

      if (response.ok) {
        const cache = await caches.open(CACHE_VERSION);
        await cache.put(request, response.clone());
      }

      return response;
    } catch (error) {
      return new Response('Offline', { status: 503 });
    }
  })());
});
