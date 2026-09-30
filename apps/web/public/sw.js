/* HASUT web shell. Do not cache API, media, or navigations — those carry session and PII. */
const CACHE = "hasut-shell-v1";
const SHELL = ["/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/media/") ||
    request.mode === "navigate"
  ) {
    return;
  }
  if (!SHELL.includes(url.pathname)) {
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
});
