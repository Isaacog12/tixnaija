/**
 * TixNaija Service Worker - KILL SWITCH
 * This replaces the old caching service worker to force unregistration
 * and cache deletion for all returning users.
 */

self.addEventListener('install', () => {
  // Skip waiting to immediately overwrite the old service worker
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => {
      self.registration.unregister();
    })
  );
  self.clients.claim();
});
