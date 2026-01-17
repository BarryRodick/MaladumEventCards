/**
 * app-utils.js - General application utilities
 */

/**
 * Simple debounce utility to limit how often a function executes
 */
export function debounce(fn, delay = 400) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Analytics tracking helper
 */
export function trackEvent(eventCategory, eventAction, eventLabel = null, eventValue = null) {
    if (typeof gtag === 'function') {
        const eventData = {
            event_category: eventCategory,
            event_label: eventLabel,
            value: eventValue
        };
        gtag('event', eventAction, eventData);
    }
}

/**
 * Toast notification helper
 */
export function showToast(message) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toastId = 'toast-' + Date.now();
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-white bg-dark border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    const toastElement = document.getElementById(toastId);

    if (typeof bootstrap !== 'undefined') {
        const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
        toast.show();

        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
}
