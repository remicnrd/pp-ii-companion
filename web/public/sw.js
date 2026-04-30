// Personal Power II — service worker
// Strategy:
//   - audio (/audio/*) → cache-first with proper HTTP Range support (iOS resume)
//   - program-data + transcripts → stale-while-revalidate
//   - everything else → network-first with cache fallback

const VERSION = "v2";
const AUDIO_CACHE = `ppii-audio-v1`; // keep audio cache stable across SW versions
const DATA_CACHE = `ppii-data-${VERSION}`;
const SHELL_CACHE = `ppii-shell-${VERSION}`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("ppii-data-") && k !== DATA_CACHE)
          .concat(keys.filter((k) => k.startsWith("ppii-shell-") && k !== SHELL_CACHE))
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

  if (url.pathname.endsWith(".mp3") || url.pathname.includes("/audio/")) {
    event.respondWith(audioStrategy(req));
    return;
  }
  if (url.pathname.includes("/program-data/") || url.pathname.includes("/transcripts/")) {
    event.respondWith(staleWhileRevalidate(req, DATA_CACHE));
    return;
  }
  // Don't intercept Next.js dev/runtime that isn't /_next/static
  if (url.pathname.includes("/_next/") && !url.pathname.includes("/_next/static/")) {
    return;
  }
  event.respondWith(networkFirst(req, SHELL_CACHE));
});

/**
 * Audio strategy with HTTP Range support.
 *
 * iOS' AVAudioPlayer issues Range requests when starting playback and again
 * when *resuming* a paused stream (e.g. unlocking after lock-screen pause).
 * If we serve the cached full body with `200 OK` to a Range request,
 * iOS rejects the response and refuses to resume — symptom: lock-screen
 * pause works, play does nothing.
 *
 * Fix: synthesize a `206 Partial Content` from the cached body when the
 * request carries a Range header.
 */
async function audioStrategy(req) {
  const cache = await caches.open(AUDIO_CACHE);
  // Important: match without considering Range header (cache.match treats
  // headers loosely but be explicit so a Range req still hits the stored full).
  let cached = await cache.match(req, { ignoreVary: true, ignoreSearch: false });

  if (!cached) {
    // Not in cache — fetch from network. Don't cache 206 responses.
    try {
      const res = await fetch(req);
      // Only cache full 200 responses (so we have the whole file to slice later).
      if (res.ok && res.status === 200) {
        // Need a non-range request to populate cache fully.
        try {
          const fullRes = req.headers.has("range") ? await fetch(req.url) : res.clone();
          if (fullRes.ok && fullRes.status === 200) {
            await cache.put(req, fullRes.clone());
          }
        } catch {
          /* network refetch failed; serve what we have */
        }
      }
      return res;
    } catch {
      return new Response("offline", { status: 504 });
    }
  }

  const range = req.headers.get("range");
  if (!range) return cached;

  const match = /^bytes=(\d+)-(\d+)?$/.exec(range);
  if (!match) return cached;

  const buffer = await cached.arrayBuffer();
  const total = buffer.byteLength;
  const start = parseInt(match[1], 10);
  const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
  if (start >= total || start > end) {
    return new Response(null, {
      status: 416,
      statusText: "Range Not Satisfiable",
      headers: { "Content-Range": `bytes */${total}` },
    });
  }
  const slice = buffer.slice(start, end + 1);
  return new Response(slice, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": cached.headers.get("Content-Type") || "audio/mpeg",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
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
        if (res.ok && res.status === 200) await cache.put(url, res.clone());
      }),
    );
  }
});
