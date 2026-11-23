/* DualDeck service worker.
   Caches the app itself so it opens with no connection (airplane mode).
   It never touches audio: online streams, files from your iPhone and
   range requests always go straight to their source. */
var CACHE = 'dualdeck-1.2';
var ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Network first (to pick up updates), cached copy if offline or slow.
    e.respondWith(new Promise(function (resolve) {
      var done = false;
      function fallback() {
        if (done) return;
        done = true;
        caches.match('./index.html').then(function (r) { resolve(r || caches.match('./')); });
      }
      var timer = setTimeout(fallback, 3500);
      fetch(req).then(function (res) {
        clearTimeout(timer);
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        }
        if (!done) { done = true; resolve(res); }
      }).catch(function () { clearTimeout(timer); fallback(); });
    }));
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
