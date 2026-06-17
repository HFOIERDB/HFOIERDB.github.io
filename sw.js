const CACHE = "hfoi-v1";

// Files to cache immediately on install
const PRECACHE = [
  "./",
  "./index.html",
  "./hfoi-players.html",
  "./hfoi-schools.html",
  "./hfoi-contests.html",
  "./hfoi-contest-detail.html",
  "./hfoi-player-detail.html",
  "./hfoi-school-detail.html",
  "./hfoi-announcement-detail.html",
  "./styles.css",
  "./site.js"
];

self.addEventListener("install", function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(PRECACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(e) {
  // Only cache GET requests to same origin
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.open(CACHE).then(function(cache) {
      return cache.match(e.request).then(function(cached) {
        var fetchPromise = fetch(e.request).then(function(response) {
          if (response.ok) cache.put(e.request, response.clone());
          return response;
        }).catch(function() { return cached; });
        return cached || fetchPromise;
      });
    })
  );
});
