/* Offline support for the Oun Clinic app.
   SHELL_CACHE: the app page itself — bump its number whenever index.html changes.
   BOOK_CACHE: book pages and pictures — kept across app updates; bump only if the book files change. */
const PREFIX = "oun-";
const SHELL_CACHE = PREFIX + "shell-v6";
const BOOK_CACHE = PREFIX + "book-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./news.json"];
const IS_ASSET = /\.(bin|webp|png|jpg)$/;

self.addEventListener("install", (event) => {
  /* "reload" skips the phone's web cache, so a new version is picked up right after it is uploaded. */
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const old = keys.filter((k) => k.startsWith(PREFIX) && k !== SHELL_CACHE && k !== BOOK_CACHE);
    /* Older versions kept everything in one cache: move the already-downloaded book there, so nobody downloads it twice. */
    const book = await caches.open(BOOK_CACHE);
    for (const k of old.filter((k) => /^oun-v\d+$/.test(k))) {
      const c = await caches.open(k);
      for (const req of await c.keys()) {
        if (IS_ASSET.test(new URL(req.url).pathname) && !(await book.match(req))) {
          const res = await c.match(req); if (res) await book.put(req, res);
        }
      }
    }
    await Promise.all(old.map((k) => caches.delete(k)));
    await self.clients.claim();
    /* After an update, reopen any open app window so it uses the new files. */
    if (old.length) (await self.clients.matchAll({ type: "window" })).forEach((c) => { if (c.navigate) c.navigate(c.url).catch(() => {}); });
  })());
});

function save(cacheName, req, res) {
  if (res && res.ok) { const copy = res.clone(); caches.open(cacheName).then((c) => c.put(req, copy)); }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* News: newest from the internet when online, saved copy when offline. */
  if (url.pathname.endsWith("/news.json")) {
    event.respondWith(fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then((res) => save(SHELL_CACHE, req, res)).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  /* Book pages and pictures: download once, then always from the phone. */
  if (IS_ASSET.test(url.pathname)) {
    event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => save(BOOK_CACHE, req, res))));
    return;
  }
  /* App page: open instantly from the phone, refresh the saved copy in the background. */
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const fresh = fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then((res) => save(SHELL_CACHE, req, res)).catch(() => hit || caches.match("./index.html"));
      return hit || fresh;
    })
  );
});
