// Personal Power II — service worker
// Strategy:
//   - audio (/audio/*) → cache-first, persistent
//   - program-data + transcripts → stale-while-revalidate
//   - everything else → network-first with cache fallback

const VERSION = "v1";
const AUDIO_CACHE = `ppii-audio-${VERSION}`;
const DATA_CACHE = `ppii-data-${VERSION}`;
const SHELL_CACHE = `ppii-shell-${VERSION}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.endsWith(VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/audio/")) {
    event.respondWith(cacheFirst(req, AUDIO_CACHE));
    return;
  }
  if (url.pathname.startsWith("/program-data/") || url.pathname.startsWith("/transcripts/")) {
    event.respondWith(staleWhileRevalidate(req, DATA_CACHE));
    return;
  }
  // Don't intercept Next.js HMR or RSC streams
  if (url.pathname.startsWith("/_next/") && !url.pathname.startsWith("/_next/static/")) {
    return;
  }
  event.respondWith(networkFirst(req, SHELL_CACHE));
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw new Error("offline and no cache");
  }
}

// Allow client to ask for explicit prefetch (e.g. "download this day for offline").
self.addEventListener("message", (event) => {
  if (event.data?.type === "prefetch-audio") {
    const url = event.data.url;
    event.waitUntil(
      caches.open(AUDIO_CACHE).then(async (cache) => {
        const existing = await cache.match(url);
        if (existing) return;
        const res = await fetch(url);
        if (res.ok) await cache.put(url, res.clone());
      }),
    );
  }
});
