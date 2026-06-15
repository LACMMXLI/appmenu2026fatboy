const CACHE_VERSION = 'fatboy-menu-v2';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const ADMIN_ROUTE_PREFIXES = ['/admin-catalog', '/branch-orders'];

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/images/logo.png',
  '/icons/pwa-icon-192.png',
  '/icons/pwa-icon-512.png',
  '/icons/pwa-maskable-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('fatboy-menu-') && ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api') || url.hostname === 'bakendmenu.fatboymexicali.com') return;
  if (isAdminRoute(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});

function isAdminRoute(url) {
  if (url.origin !== self.location.origin) return false;
  return ADMIN_ROUTE_PREFIXES.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`));
}

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (
      url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/images/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname === '/manifest.webmanifest'
    )
  ) || url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com';
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(APP_SHELL_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    return (await cache.match('/index.html')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }

  return response;
}
