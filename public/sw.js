/**
 * Offline shell for Plauvia.
 *
 * The app is local-first: once the code is cached there is nothing else it
 * needs from the network, so the goal here is simply "never fail to start".
 * HTML is fetched network-first (so a deploy lands on the next reload) while
 * hashed assets, fonts, cmaps and wasm are cache-first — they never change
 * under the same URL.
 */
const VERSION = 'plauvia-v9';
const SHELL = [
  // `/` is a redirect now, and `cache.addAll` refuses a redirected response —
  // asking for it would throw away the whole shell, silently, on install.
  '/index.html',
  '/homepage',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // The typeface is part of the brand, so it is part of the offline shell.
  '/fonts/inter.woff2',
  '/fonts/inter-cyrillic.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: try the network so updates arrive, fall back to what we have.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only a real page is kept, and only under its own address.
          //
          // Both halves matter. Without the first, a single 404 — a mistyped
          // address, or a few minutes of a server answering badly — is written
          // over the copy the app starts from, and every later start offline
          // serves that instead of the app. Without the second, every page
          // became the start-up shell in turn: reading the English privacy
          // policy once meant the app booted from the privacy policy's shell
          // afterwards, with its title and its canonical, until something else
          // overwrote it.
          if (response.ok) {
            const copy = response.clone();
            void caches.open(VERSION).then((cache) => {
              void cache.put(request, copy);
              // The app's own addresses share one shell; the home page is what
              // a cold offline start falls back to.
              if (url.pathname === '/homepage') void cache.put('/index.html', response.clone());
            });
          }
          return response;
        })
        .catch(() =>
          // This address if it has been seen, then the home page, which is the
          // one page guaranteed to be in the cache from the install.
          caches
            .match(request)
            .then((hit) => hit ?? caches.match('/index.html'))
            .then((hit) => hit ?? Response.error()),
        ),
    );
    return;
  }

  // The cloud settings must not come from a months-old cache: changing the
  // project would otherwise need a cache bust to take effect.
  if (url.pathname.endsWith('/cloud.json')) {
    event.respondWith(fetch(request).catch(() => caches.match(request).then((hit) => hit ?? Response.error())));
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          void caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
