const CACHE = 'paket-tracker-v2';
const SHELL = ['/', '/index.html', '/styles/app.css', '/src/app.js',
  '/src/auth.js', '/src/scanner.js', '/src/detector.js',
  '/src/fetcher.js', '/src/store.js', '/src/ui.js', '/config.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e =>
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', e =>
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  )
);
