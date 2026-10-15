const CACHE_NAME = 'bidul-pwa-v5';

// 오프라인에서도 작동하도록 캐싱 전략 강화 (Stale-While-Revalidate)
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // API 요청이나 Chrome 확장 프로그램 요청은 제외
    if (e.request.url.startsWith('chrome-extension') || e.request.url.includes('extension')) return;

    e.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(e.request).then((cachedResponse) => {
                const fetchedResponse = fetch(e.request).then((networkResponse) => {
                    // 외부 라이브러리(폰트, jsdelivr 등)도 캐시에 저장
                    if (e.request.method === 'GET') {
                        cache.put(e.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    return cachedResponse;
                });
                return cachedResponse || fetchedResponse;
            });
        })
    );
});