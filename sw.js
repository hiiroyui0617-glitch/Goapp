const CACHE = "ikan-go-v3";
const ASSETS = ["./","./index.html","./styles.css","./app.js","./go-engine.js","./ai.js","./ai-worker.js","./effects.js","./icon.svg","./manifest.webmanifest",
  "./assets/cutins/rise.svg","./assets/cutins/fall.svg","./assets/cutins/win.svg",
  "./assets/cutins/lose.svg","./assets/cutins/undo.svg"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then(c => c.put(event.request, copy));
    }
    return response;
  })));
});