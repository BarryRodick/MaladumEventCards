// Unified service worker combining caching and version logic
const CACHE_NAME = 'maladum-event-cards-v6';
const APP_VERSION = '2.5';
const GOOGLE_ANALYTICS_ID = 'G-ZMTSM9B7Q7';

const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './deckbuilder.js',
    './card-utils.js',
    './dungeons_of_enveron.html',
    './forbidden_creed.html',
    './about.html',
    './manifest.json',
    './logos/gameicon.jpg',
    './logos/background.png',
    './maladumcards.json',
    './difficulties.json',
    './version.json',
    './cardimages/back.jpg',
    'https://www.googletagmanager.com/gtag/js?id=' + GOOGLE_ANALYTICS_ID,
];

self.addEventListener('message', (event) => {
    if (event.data === 'GET_VERSION') {
        event.ports[0].postMessage(APP_VERSION);
    }
});

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            caches.keys().then(names => Promise.all(names.map(name => {
                if (name !== CACHE_NAME) {
                    return caches.delete(name);
                }
            }))),
            fetch('./version.json?nocache=' + Date.now())
                .then(resp => resp.json())
                .then(data => {
                    if (data.version !== APP_VERSION) {
                        self.clients.matchAll().then(clients => {
                            clients.forEach(client => client.postMessage({ type: 'NEW_VERSION', version: data.version }));
                        });
                    }
                })
                .catch(() => {})
        ]).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.url.includes('google-analytics.com')) {
        if (!navigator.onLine) {
            event.respondWith(new Response('', { status: 200, statusText: 'OK' }));
            return;
        }
    }

    if (event.request.method !== 'GET') return;

    if (event.request.url.includes('/cardimages/')) {
        event.respondWith(
            caches.match(event.request).then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                });
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});
