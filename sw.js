// sw.js — Markup Editor Service Worker
const CACHE_NAME = 'markup-editor-v1';

// キャッシュ対象ファイル
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Google Fonts（オフライン時はフォールバック）
  'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;600&family=JetBrains+Mono:wght@400;500&display=swap'
];

// ── インストール：コアアセットをキャッシュ ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // ローカルアセットは必ずキャッシュ、外部フォントは失敗してもOK
      const local  = ASSETS.filter(u => !u.startsWith('http'));
      const remote = ASSETS.filter(u =>  u.startsWith('http'));
      return cache.addAll(local).then(() =>
        Promise.allSettled(remote.map(u => cache.add(u)))
      );
    })
  );
  self.skipWaiting();
});

// ── アクティベート：古いキャッシュを削除 ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── フェッチ：Cache First（ローカル）/ Network First（外部）──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // chrome-extension等は無視
  if (!['http:', 'https:'].includes(url.protocol)) return;

  // Google Fonts などの外部リソース → Network First
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // ローカルアセット → Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
