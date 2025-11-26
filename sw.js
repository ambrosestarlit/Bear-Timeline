// Starlit Timeline Editor Service Worker
const CACHE_NAME = 'starlit-timeline-v2.6.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './app-core.js',
    './app-extensions.js',
    './modules/clipping.js',
    './modules/sceneManager.js',
    './modules/advCaption.js',
    './modules/utils/drawing.js',
    './modules/utils/storage.js',
    './modules/utils/math.js',
    './JK-Maru-Gothic-M.otf',
    './cinecaption226.ttf',
    './play.png',
    './pause.png',
    './stop.png',
    './undo.png',
    './redo.png',
    './key.png',
    './slider.png',
    './seekbar.png',
    './pin-01.png',
    './pin-02.png',
    './pin-03.png',
    './pin-04.png',
    './pin-05.png',
    './icon-192.png',
    './icon-512.png',
    './manifest.json',
    // ADV字幕用メッセージボックス画像
    './assets/msgbox/elegant/E01.png',
    './assets/msgbox/elegant/E02.png',
    './assets/msgbox/elegant/E03.png',
    './assets/msgbox/stylish/S01.png',
    './assets/msgbox/dot/D01.png',
    './assets/msgbox/dot/D02.png',
    './assets/msgbox/dot/D03.png',
    './assets/msgbox/dot/D04.png',
    './assets/msgbox/pop/P01.png',
    './assets/msgbox/pop/P02.png',
    './assets/msgbox/pop/P03.png',
    './assets/msgbox/pop/P04.png',
    './assets/msgbox/japanese/J01.png',
    './assets/msgbox/japanese/J02.png',
    './assets/msgbox/japanese/J03.png',
    './assets/msgbox/japanese/J04.png'
];

// インストール時にキャッシュ
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .catch((err) => {
                console.log('[SW] Cache failed:', err);
            })
    );
    self.skipWaiting();
});

// アクティベート時に古いキャッシュを削除
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// フェッチ時にキャッシュを返す（Network First戦略）
self.addEventListener('fetch', (event) => {
    // POSTリクエストやchrome-extensionはスキップ
    if (event.request.method !== 'GET' || 
        event.request.url.startsWith('chrome-extension://')) {
        return;
    }
    
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // 成功したらキャッシュを更新
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // オフライン時はキャッシュから返す
                return caches.match(event.request);
            })
    );
});
