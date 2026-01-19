import { showToast } from './app-utils.js';

const UPDATE_CHECK_SELECTOR = '[data-check-updates]';
const VERSION_CHECK_TIMEOUT_MS = 2000;
let updateListenerAttached = false;
let serviceWorkerRegistering = false;

function notifyUser(message) {
    const toastContainer = document.getElementById('toastContainer');
    if (toastContainer) {
        showToast(message);
        return;
    }
    window.alert(message);
}

async function ensureServiceWorkerRegistration() {
    if (!('serviceWorker' in navigator) || serviceWorkerRegistering) return null;
    serviceWorkerRegistering = true;
    try {
        const existing = await navigator.serviceWorker.getRegistration();
        if (existing) return existing;
        return await navigator.serviceWorker.register('./service-worker.js');
    } catch (error) {
        console.warn('Service worker registration failed:', error);
        return null;
    } finally {
        serviceWorkerRegistering = false;
    }
}

async function getInstalledVersion() {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return null;

    return new Promise((resolve) => {
        const channel = new MessageChannel();
        const timeoutId = setTimeout(() => resolve(null), VERSION_CHECK_TIMEOUT_MS);

        channel.port1.onmessage = (event) => {
            clearTimeout(timeoutId);
            resolve(event.data || null);
        };

        navigator.serviceWorker.controller.postMessage('GET_VERSION', [channel.port2]);
    });
}

async function fetchLatestVersion() {
    const response = await fetch(`./version.json?nocache=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error('Failed to fetch version.json');
    }
    const data = await response.json();
    return data.version || null;
}

export async function checkForUpdates() {
    try {
        const registration = await ensureServiceWorkerRegistration();
        if (registration) {
            registration.update();
        }

        const [installedVersion, latestVersion] = await Promise.all([
            getInstalledVersion(),
            fetchLatestVersion()
        ]);

        if (!latestVersion) {
            notifyUser('Unable to check for updates.');
            return;
        }

        if (installedVersion && latestVersion !== installedVersion) {
            showUpdateNotification(latestVersion);
            return;
        }

        notifyUser(installedVersion ? 'You are up to date.' : `Current version: ${latestVersion}`);
    } catch (error) {
        console.warn('Update check failed:', error);
        notifyUser('Unable to check for updates.');
    }
}

export function setupManualUpdateCheck(selector = UPDATE_CHECK_SELECTOR) {
    document.querySelectorAll(selector).forEach(button => {
        if (button.dataset.updateCheckBound === 'true') return;
        button.dataset.updateCheckBound = 'true';
        button.addEventListener('click', (event) => {
            event.preventDefault();
            checkForUpdates();
        });
    });
}

export function setupUpdateNotifications() {
    if (!('serviceWorker' in navigator) || updateListenerAttached) return;

    const register = () => ensureServiceWorkerRegistration();
    if (document.readyState === 'complete') {
        register();
    } else {
        window.addEventListener('load', register, { once: true });
    }

    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'NEW_VERSION') {
            showUpdateNotification(event.data.version);
        }
    });

    updateListenerAttached = true;
}

export function showUpdateNotification(newVersion) {
    const updateModal = `
        <div class="modal fade" id="updateModal" tabindex="-1" role="dialog" aria-labelledby="updateModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered" role="document">
                <div class="modal-content bg-dark text-white">
                    <div class="modal-header">
                        <h5 class="modal-title" id="updateModalLabel">New Version Available</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p>A new version (${newVersion}) of the app is available.</p>
                        <p>Update now to get the latest features and improvements.</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Later</button>
                        <button type="button" class="btn btn-primary" id="updateNowButton">Update Now</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById('updateModal');
    if (existingModal) {
        existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', updateModal);
    const modalEl = document.getElementById('updateModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    document.getElementById('updateNowButton').addEventListener('click', () => {
        if ('caches' in window) {
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            }).then(() => {
                window.location.reload();
            });
        } else {
            window.location.reload();
        }
    });
}

if (typeof window !== 'undefined') {
    window.showUpdateNotification = showUpdateNotification;
}
