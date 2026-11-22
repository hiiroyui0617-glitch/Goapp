const CACHE = "ikan-go-voice-v8";
const ASSETS = ["./","./index.html","./styles.css","./app.js","./go-engine.js","./ai.js","./ai-worker.js","./effects.js","./voice-clips.js","./vendor/jszip.min.js","./icon.svg","./manifest.webmanifest",
  "./assets/cutins/rise.svg","./assets/cutins/fall.svg","./assets/cutins/win.svg",
  "./assets/cutins/lose.svg","./assets/cutins/undo.svg",
  "./assets/cutins/pass.svg","./assets/cutins/illegal.svg","./assets/cutins/hint.svg",
  "./assets/cutins/score.svg","./assets/cutins/start.svg","./assets/cutins/novice.svg",
  "./assets/voices/rise.mp3","./assets/voices/fall.mp3","./assets/voices/win.mp3",
  "./assets/voices/lose.mp3","./assets/voices/undo.mp3","./assets/voices/pass.mp3",
  "./assets/voices/illegal.mp3","./assets/voices/hint.mp3","./assets/voices/score.mp3",
  "./assets/voices/start.mp3","./assets/voices/novice.mp3"];
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