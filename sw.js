const CACHE_VERSION = 'cufintek-shell-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './config.json',
  './site.webmanifest',
  './favicon.ico',
  './favicon-96x96.png',
  './favicon.svg',
  './apple-touch-icon.png',
  './app.js',
  './View_Tagihan.html',
  './View_Kunjungan.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      await Promise.all(
        APP_SHELL_ASSETS.map(async (asset) => {
          try {
            await cache.add(asset);
          } catch (err) {
            console.warn('Lewati aset gagal pre-cache:', asset, err);
          }
        })
      );
      await self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

async function networkFirstWithCacheFallback(request, cacheName, timeoutMs = 3500) {
  const cache = await caches.open(cacheName);
  const cached =
    (await cache.match(request, { ignoreSearch: true })) ||
    (await caches.match(request, { ignoreSearch: true }));

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const networkResponse = await fetch(request, {
      signal: controller ? controller.signal : undefined
    });
    if (timer) clearTimeout(timer);

    if (networkResponse && networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    if (timer) clearTimeout(timer);
    if (cached) return cached;
    return new Response(JSON.stringify({ offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}

async function cacheFirstWithBackgroundUpdate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });

  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const networkResponse = await fetchPromise;
  if (networkResponse) return networkResponse;

  return new Response('Offline - aset belum tersedia di cache.', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 1. Navigasi halaman -> coba jaringan, jika gagal buka index.html dari cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedIndex =
          (await caches.match('./index.html', { ignoreSearch: true })) ||
          (await caches.match('./', { ignoreSearch: true }));
        return (
          cachedIndex ||
          new Response('Offline - halaman belum tersimpan.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          })
        );
      })
    );
    return;
  }

  // 2. config.json -> utamakan jaringan dengan timeout, fallback ke cache (abaikan ?nocache=...)
  if (url.pathname.endsWith('/config.json')) {
    event.respondWith(networkFirstWithCacheFallback(request, RUNTIME_CACHE, 3500));
    return;
  }

  // 3. Aset statis & view offline -> cache-first + update latar belakang
  event.respondWith(cacheFirstWithBackgroundUpdate(request, STATIC_CACHE));
});
