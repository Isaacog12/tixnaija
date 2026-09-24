/**
 * TixNaija Service Worker
 * Strategy: cache-first for static assets, network-first for API/Supabase calls.
 * Improves PWABuilder readiness score and gives offline resilience for shell assets.
 */

const CACHE_NAME = 'tixnaija-v1';

// Static shell assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

// ── Install: pre-cache shell assets ───────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  // Take over immediately without waiting for existing tabs to close
  self.skipWaiting();
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: tiered strategy ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin requests (Supabase, Paystack, fonts), and
  // browser-extension requests entirely — let them go straight to network.
  if (
    request.method !== 'GET' ||
    !url.origin.startsWith(self.location.origin)
  ) {
    return;
  }

  // API routes & auth — always network-first (never serve stale auth)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_server')) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets (fonts, images, icons, JS/CSS chunks) — cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // Only cache successful same-origin responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, toCache));
        return response;
      });
    })
  );
});
