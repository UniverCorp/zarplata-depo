const CACHE_NAME = 'zarplata-depo-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './js/models.js',
  './js/calc.js',
  './js/backup.js',
  './js/router.js',
  './js/views/ui.js',
  './js/views/charts.js',
  './js/views/home.js',
  './js/views/slesari.js',
  './js/views/lokomotivy.js',
  './js/views/dopRaboty.js',
  './js/views/dni.js',
  './js/views/den.js',
  './js/views/avans.js',
  './js/views/itog.js',
  './js/views/nastroiki.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
