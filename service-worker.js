// service-worker.js for PWA functionality

const CACHE_NAME = 'deck-builder-v1';
const urlsToCache = [
    '/',
    './index.html',
    './styles.css',
    './deckbuilder.js',
    './manifest.json',
    // Add other assets like images, logos, JSON files, etc.
    './logos/gameicon.jpg',
    './logos/gameicon.jpg',
    './maladumcards.json',
    // Add paths to your card images and logos
    // Example:
    // '/cardimages/back.jpg',
    // '/cardimages/card1.png',
    // '/logos/logo1.jpg',
    // Include all assets that need to be available offline
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
