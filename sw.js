// Ganti versi ini SETIAP KALI kamu ubah wrapper / aset statis
const CACHE_NAME = 'cu-penagihan-v4.5.4';
const CORE_ASSETS = [
  './',
  './index.html'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_ASSETS).catch(function () {
        // Jangan gagalkan install jika salah satu aset gagal saat awal
        return Promise.resolve();
      });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Hanya tangani request satu origin dengan wrapper GitHub Pages
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(function (networkRes) {
        if (networkRes && networkRes.status === 200) {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, copy);
          });
        }
        return networkRes;
      })
      .catch(function () {
        return caches.match(req).then(function (cachedRes) {
          if (cachedRes) return cachedRes;
          if (req.mode === 'navigate') {
            return caches.match('./index.html').then(function (indexRes) {
              return indexRes || caches.match('./') || new Response(
                '<!doctype html><html><body style="font-family:sans-serif;background:#1e1616;color:#f9fafb;padding:20px;"><h3>Mode Offline</h3><p>Halaman wrapper belum sempat tersimpan di cache. Hubungkan ke internet sebentar lalu buka ulang.</p></body></html>',
                { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
              );
            });
          }
          return new Response('', { status: 503, statusText: 'Offline' });
        });
      })
  );
});

self.addEventListener('message', function (event) {
  if (!event.data) return;

  if (event.data.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.action === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(function (names) {
        return Promise.all(names.map(function (n) { return caches.delete(n); }));
      }).then(function () {
        if (event.source && event.source.postMessage) {
          event.source.postMessage({ action: 'CACHE_CLEARED' });
        }
      })
    );
  }
});
