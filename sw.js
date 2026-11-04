// Ganti versi ini SETIAP KALI kamu ubah index.html wrapper
const CACHE_NAME = 'cu-penagihan-v4.4.3';

self.addEventListener('install', function (event) {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames.map(function (cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function (event) {
    // ⭐ STRATEGI: network-only untuk semua request.
    // Alasannya: aplikasi utama ada di iframe GAS (cross-origin),
    // dan wrapper GitHub Pages harus selalu fresh.
    // Kita TIDAK meng-cache apa pun supaya update selalu langsung terlihat.
    //
    // Kalau nanti mau offline mode, ganti dengan cache-first untuk aset statis
    // (favicon, manifest) dan network-first untuk HTML.
    event.respondWith(fetch(event.request).catch(function () {
        // Fallback: kalau offline & ada cache lama, pakai (opsional)
        return caches.match(event.request);
    }));
});

// ⭐ Terima perintah dari halaman untuk skip waiting / clear cache
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
