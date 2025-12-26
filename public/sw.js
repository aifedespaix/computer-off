const CACHE_NAME = 'pc-control-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    // Network first approach for API, Cache First for assets?
    // Since it's a local controller, we generally want fresh content but need it to load offline-ish to show "Connect to Wifi" etc if we were fancy.
    // Let's stick to a simple "Stale-While-Revalidate" or "Network First" since it's local dev.

    // For this specific usecase (Local Control), if network is down (no wifi), the app won't work anyway.
    // The main goal of SW here is just to satisfy PWA installability criteria.

    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
