/* Service worker: what makes this an app you can open with no signal.

   The cache list is generated from the <script> list in index.html by
   tools/build-sw.js -- the same single source of truth the test harness reads,
   because a file that loads on the page but is missing here would work
   perfectly until the phone goes offline, and then break in a way nobody could
   reproduce at a desk.

   Cache-first, because this app has no server to be fresh against: every byte
   is static and the data lives in localStorage. A new CACHE_NAME is what ships
   an update -- the old cache is dropped on activate, so bumping the version is
   the whole deploy story. */

const CACHE_NAME = "campfire-v35";

const ASSETS = [
  "./",
  "index.html",
  "style.css",
  "manifest.json",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
  "logo-mark.png",
  "favicon-64.png",
  "identity.js",
  "srd-data.js",
  "srd-races.js",
  "srd-classes.js",
  "srd-equipment.js",
  "srd-magic-items.js",
  "srd-spells-low.js",
  "srd-spells-high.js",
  "character-data.js",
  "demo-character.js",
  "content-merge.js",
  "dice-history.js",
  "roll.js",
  "icons.js",
  "ui.js",
  "theme.js",
  "characters.js",
  "tutorial.js",
  "creator.js",
  "creator-equipment.js",
  "party-protocol.js",
  "party-net.js",
  "party.js",
  "content.js",
  "content-forms.js",
  "rests.js",
  "choices.js",
  "help.js",
  "tab-combat.js",
  "tab-character.js",
  "tab-spells.js",
  "spell-cast.js",
  "tab-inventory.js",
  "inventory-give.js",
  "tab-notes.js",
  "app.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      // don't sit in "waiting" behind the old worker -- on a phone that means
      // the update lands two launches later, which is baffling to debug
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // only GETs, and only our own origin: a relay connection must never be
  // served a stale cached answer
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
      // cache what we fetched, so a file added after install still works offline
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
      return response;
    }).catch(() =>
      // an offline navigation to any path is still the one page this app has
      event.request.mode === "navigate" ? caches.match("index.html") : undefined
    ))
  );
});
