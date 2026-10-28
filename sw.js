const CACHE_NAME = 'cu-penagihan-v4.1.2'; // Ganti versi ini setiap kali update kode

self.addEventListener('install', function(event) {
  self.skipWaiting(); // Paksa Service Worker baru langsung aktif
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName); // Hapus cache lama
          }
        })
      );
    }).then(function() {
      return self.clients.claim(); // Ambil alih kontrol halaman
    })
  );
});

self.addEventListener('fetch', function(event) {
  // Biarkan kosong, ini hanya untuk memenuhi syarat PWA
});
