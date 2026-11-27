const CACHE_VERSION = 'cufintek-shell-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Sesuaikan daftar aset inti dengan nama file aktual di project kamu
const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './config.json',
  './manifest.json'
  // Tambahkan file CSS, JS utama, dan HTML view menu offline kamu di sini, contoh:
  // './styles.css',
  './app.js',
  './View_Tagihan.html',
  './View_Kunjungan.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
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

async function networkFirstWithCacheFallback(request, cacheName, timeoutMs = 4000) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const networkResponse = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    clearTimeout(timer);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirstWithBackgroundUpdate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
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
    statusText: 'Service Unavailable'
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Hanya tangani origin sendiri agar panggilan API eksternal tidak terganggu
  if (url.origin !== self.location.origin) return;

  // 1. Navigasi halaman -> coba jaringan cepat, jika gagal buka index.html dari cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedIndex =
          (await caches.match('./index.html')) || (await caches.match('./'));
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

  // 2. config.json -> utamakan data terbaru saat online, tetapi selalu fallback ke cache
  if (url.pathname.endsWith('/config.json')) {
    event.respondWith(networkFirstWithCacheFallback(request, RUNTIME_CACHE, 3500));
    return;
  }

  // 3. App shell & aset statis -> cache-first agar instan & aman saat mati sinyal
  event.respondWith(cacheFirstWithBackgroundUpdate(request, STATIC_CACHE));
});
