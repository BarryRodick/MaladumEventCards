// service-worker.js for PWA functionality

const CACHE_NAME = 'deck-builder-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/deckbuilder.js',
    '/manifest.json',
    // Add other assets like images, logos, JSON files, etc.
    '/logos/gameicon.png',
    '/logos/gameicon.png',
    // Include paths to your card images, logos, and JSON data
    '/maladumcards.json',
    // Add other files as needed
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
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
                return fetch(event.request);
            })
    );
});
