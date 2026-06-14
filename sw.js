/* Service Worker for 6ColorQR PWA */
const CACHE_NAME = '6colorqr-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAllは1つでも失敗すると全体が失敗するので、個別にtryする
      return Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] cache add failed:', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/**
 * このリクエストをキャッシュ対象にしてよいか判定する。
 * - http/https スキームのみ (chrome-extension://, file://, data: などは除外)
 * - 同一オリジンのみ
 * - 通常のレスポンス(opaqueでない)のみ
 */
function isCacheable(request, response) {
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.origin !== self.location.origin) return false;
  if (!response || response.status !== 200) return false;
  if (response.type !== 'basic') return false;
  return true;
}

/**
 * このリクエストをそもそも fetch ハンドラで処理するか判定する。
 * http/https 以外（chrome-extension:// 等）はブラウザに任せる。
 */
function shouldHandle(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return true;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!shouldHandle(req)) return; // 非対応スキームは respondWith しない

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (isCacheable(req, res)) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // put 自体も chrome-extension などで失敗する可能性があるので保険
            cache.put(req, copy).catch((err) => {
              console.warn('[SW] cache.put failed:', req.url, err);
            });
          });
        }
        return res;
      }).catch(() => {
        // オフライン時、ナビゲーション要求にはindex.htmlを返す
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
