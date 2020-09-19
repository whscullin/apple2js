var cacheName = 'v1:static';

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(cacheName).then(function(cache) {
            return cache.addAll([
                'css/apple2.css',
                'css/red-off-16.png',
                'css/red-on-16.png',
                'dist/main2.js',
                'dist/main2e.js',
                'apple2js.html',
                'apple2jse.html'
            ]).then(function() {
                self.skipWaiting();
            });
        })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request).then(function(response) {
            if (response) {
                return response;
            }
            return fetch(event.request);
        })
    );
});
