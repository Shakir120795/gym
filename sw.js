// Online-only service worker. It does NOT cache anything for offline use:
// the app requires internet and shows its own offline screen. The fetch
// handler exists so the app stays installable (PWA). Old offline caches
// from earlier versions are deleted on activate.
self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network only. If there is no internet the request fails and the app
// shows its offline screen. Nothing works offline, by design.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request));
});
