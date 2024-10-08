// service-worker.js for PWA functionality

const CACHE_NAME = 'deck-builder-v0.7'; // Incremented version
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './deckbuilder.js',
    './manifest.json',
    './logos/gameicon.jpg',
    './maladumcards.json',
    // Add paths to other assets
    // Example:
    // './cardimages/back.jpg',
    // './logos/logo1.jpg',
];

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install Event');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching all assets');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting()) // Force the waiting service worker to become the active service worker
            .catch((error) => {
                console.error('[Service Worker] Failed to cache assets', error);
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activate Event');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cache) => {
                        if (cache !== CACHE_NAME) {
                            console.log(`[Service Worker] Deleting old cache: ${cache}`);
                            return caches.delete(cache);
                        }
                    })
                );
            })
            .then(() => self.clients.claim()) // Take control of all clients as soon as the service worker activates
            .catch((error) => {
                console.error('[Service Worker] Failed to delete old caches', error);
            })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                // Clone the request as it's a stream and can only be consumed once
                const fetchRequest = event.request.clone();
                return fetch(fetchRequest).then(
                    (networkResponse) => {
                        // Check if we received a valid response
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        // Clone the response as it's a stream and can only be consumed once
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        return networkResponse;
                    }
                ).catch((error) => {
                    console.error('[Service Worker] Fetch failed:', error);
                    // Optionally, return a fallback page or image here
                });
            })
    );
});
