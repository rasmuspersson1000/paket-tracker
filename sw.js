const CACHE = 'paket-tracker-v1';
const SHELL = ['/', '/index.html', '/styles/app.css', '/src/app.js',
  '/src/auth.js', '/src/scanner.js', '/src/detector.js',
  '/src/fetcher.js', '/src/store.js', '/src/ui.js'];

self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)))
);

self.addEventListener('fetch', e =>
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  )
);
