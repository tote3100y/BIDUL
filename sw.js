/* BIDUL PWA offline service worker
 * Keep this file beside index.html and manifest.json on the same HTTPS origin.
 * All BIDUL application logic is embedded in index.html; user content stays in IndexedDB.
 */
const CACHE_NAME = 'bidul-app-shell-v2';
const APP_SCOPE = self.registration.scope;
const APP_ROOT = new URL('./', APP_SCOPE).href;
const INDEX_URL = new URL('./index.html', APP_SCOPE).href;
const SHELL_URLS = [
  APP_ROOT,
  INDEX_URL,
  new URL('./manifest.json', APP_SCOPE).href,
  new URL('./pwa-icon-192.png', APP_SCOPE).href,
  new URL('./pwa-icon-512.png', APP_SCOPE).href
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Core files must be cached before this worker is considered installed.
    // icon.png is optional because older deployments may not contain it.
    await cache.addAll(SHELL_URLS);
    try {
      const logo = new URL('./icon.png', APP_SCOPE).href;
      const response = await fetch(logo, { cache: 'reload' });
      if (response.ok) await cache.put(logo, response);
    } catch (_) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => {
      if (key.startsWith('bidul-app-shell-') && key !== CACHE_NAME) return caches.delete(key);
      return Promise.resolve(false);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // External services (YouTube, external links, etc.) cannot be made available offline
  // by this app shell cache. Let the browser handle them normally while online.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
          // Keep the canonical app entry available as a reliable offline fallback.
          if (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
            await cache.put(INDEX_URL, response.clone());
            await cache.put(APP_ROOT, response.clone());
          }
        }
        return response;
      } catch (_) {
        return (await caches.match(request))
          || (await caches.match(APP_ROOT))
          || (await caches.match(INDEX_URL))
          || new Response('BIDUL 오프라인 화면을 찾을 수 없습니다. 인터넷 연결 상태에서 BIDUL을 한 번 실행해 주세요.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
      }
    })());
    return;
  }

  // Same-origin files: cache-first for immediate offline availability,
  // then save newly requested resources for future offline visits.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (_) {
      return new Response('', { status: 504, statusText: 'Offline resource unavailable' });
    }
  })());
});
