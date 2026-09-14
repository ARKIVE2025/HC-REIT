/* REIT Strategist v2 — Service Worker
 *
 * This file enables full PWA install on Android/iOS and offline caching.
 * Upload it to the same GitHub Pages directory as REIT_Strategist_v2.html.
 *
 * How it works:
 * - On install: pre-caches the app shell (the HTML file itself)
 * - On fetch: serves from cache when offline, falls back to network when online
 * - On activate: cleans up old cache versions
 *
 * The app still works without this file — it just won't show "Install app"
 * in Chrome's menu on Android. With this file present, users can install
 * the app to their home screen and use it offline.
 */

const CACHE_NAME = 'reit-strategist-v2';
const APP_SHELL = [
  './',
  './REIT_Strategist_v2.html',
  './sw.js'
];

// Install — pre-cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache each URL individually — ignore failures (e.g., if file doesn't exist yet)
      return Promise.allSettled(APP_SHELL.map(url => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for same-origin GET requests, network-first for everything else
self.addEventListener('fetch', event => {
  const req = event.request;
  // Only handle GET requests
  if(req.method !== 'GET') return;
  // Only handle same-origin requests (don't cache API calls to Finnhub, LLMs, brokers)
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(cached => {
      // Return cached response if we have it, otherwise try network
      return cached || fetch(req).then(res => {
        // Cache successful responses for next time
        if(res && res.status === 200 && res.type === 'basic'){
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      }).catch(() => {
        // Network failed — if we're offline and looking for a page, serve the main HTML
        if(req.mode === 'navigate'){
          return caches.match('./REIT_Strategist_v2.html');
        }
      });
    })
  );
});

// Allow the page to trigger skipWaiting via postMessage
self.addEventListener('message', event => {
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});
