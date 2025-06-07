const CACHE_NAME = 'maladum-event-cards-v4';
const VERSION = '1.0.3'; // Add version tracking
const GOOGLE_ANALYTICS_ID = 'G-ZMTSM9B7Q7';

self.addEventListener('message', (event) => {
    if (event.data === 'GET_VERSION') {
        event.ports[0].postMessage(VERSION);
    }
});

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/styles.css',
                '/dungeons_of_enveron.html',
                '/forbidden_creed.html',
                '/about.html',
                '/logos/background.png',
                '/logos/gameicon.jpg',
                'https://www.googletagmanager.com/gtag/js?id=' + GOOGLE_ANALYTICS_ID,
                // Add other resources
            ]);
        })
    );
});

// Add cache cleanup for old versions
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Handle Google Analytics when offline
self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('google-analytics.com')) {
        // If offline, store analytics requests to be sent later
        if (!navigator.onLine) {
            event.respondWith(
                new Response('', {
                    status: 200,
                    statusText: 'OK'
                })
            );
        }
    }
}); 