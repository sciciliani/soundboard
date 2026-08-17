/* Offline cache for Botonera. Core app files are precached on install;
   the bundled audio files are discovered dynamically from defaults.json
   so editing that file never requires touching this service worker. */

var CACHE = "botonera-v5";
var CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./defaults.json",
  "./css/style.css",
  "./js/synth.js",
  "./js/db.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

function audioAssetsFromDefaults() {
  return fetch("./defaults.json", { cache: "no-store" })
    .then(function (res) { return res.ok ? res.json() : { buttons: [] }; })
    .then(function (data) {
      return (data.buttons || [])
        .filter(function (b) { return b.file; })
        .map(function (b) { return "./" + b.file; });
    })
    .catch(function () { return []; });
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    audioAssetsFromDefaults().then(function (audioAssets) {
      return caches.open(CACHE).then(function (cache) {
        return cache.addAll(CORE_ASSETS.concat(audioAssets));
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // never intercept remote/internet-URL sounds

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        return response;
      }).catch(function () {
        if (event.request.mode === "navigate") return caches.match("./index.html");
      });
    })
  );
});
