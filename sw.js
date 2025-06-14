const CACHE_VERSION = 'v4';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './login.html',
  './login.js',
  './admin.js',
  './auth.js',
  './firebase.js',
  './pwa.js',
  './manifest.json',
  './styles.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
        .map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

function limitCacheSize(cacheName, maxItems) {
  caches.open(cacheName).then(cache => {
    cache.keys().then(keys => {
      if (keys.length > maxItems) {
        cache.delete(keys[0]).then(() => limitCacheSize(cacheName, maxItems));
      }
    });
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Ignore cross-origin requests like Firebase APIs
  if (!isSameOrigin) return;

  const isAsset = ASSETS.includes(url.pathname) ||
    ['document', 'script', 'style'].includes(event.request.destination);

  if (isAsset) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
  } else {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(cache => {
        return fetch(event.request).then(response => {
          cache.put(event.request, response.clone());
          limitCacheSize(RUNTIME_CACHE, 50);
          return response;
        }).catch(() => cache.match(event.request));
      })
    );
  }
});
