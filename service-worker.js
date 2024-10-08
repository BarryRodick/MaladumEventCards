// service-worker.js for PWA functionality

const CACHE_NAME = 'deck-builder-v0.3';
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
