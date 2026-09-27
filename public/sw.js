// Offline support: the app shell and sprites are cached so Ledger OS opens without a connection.
// Data itself never goes through here — it lives in localStorage.
const CACHE = 'ledgeros-v2';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './assets/coin-spin.png', './assets/coin-shine.png', './assets/icon-bag.png', './assets/icon-bill.png',
  './assets/icon-coin.png', './assets/icon-gem.png', './assets/icon-key.png'
];

// The built JS/CSS have hashed names, so read them out of index.html and cache them too.
async function precache() {
  const c = await caches.open(CACHE);
  await c.addAll(SHELL);
  const html = await (await c.match('./index.html', { ignoreVary: true })).text();
  const built = [...html.matchAll(/(?:src|href)="(\.?\/?assets\/[^"]+\.(?:js|css))"/g)].map(m => m[1]);
  await c.addAll(built);
}

self.addEventListener('install', e => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

const put = (req, res) => {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy));
  }
  return res;
};

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Pages: network first so updates show up, cached copy when offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => put('./index.html', r)).catch(() => caches.match('./index.html', { ignoreVary: true })));
    return;
  }
  // Google Fonts: serve cached, refresh in the background.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(req, { ignoreVary: true }).then(hit => {
      const net = fetch(req).then(r => put(req, r)).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  // Same-origin files (hashed JS/CSS, sprites): cache first.
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req, { ignoreVary: true }).then(hit => hit || fetch(req).then(r => put(req, r))));
  }
});
