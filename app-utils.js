/**
 * app-utils.js - General application utilities
 */

/**
 * Simple debounce utility to limit how often a function executes
 */
export function debounce(fn, delay = 400) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(context, args), delay);
    };
}

/**
 * Analytics tracking helper
 */
export function trackEvent(eventCategory, eventAction, eventLabel = null, eventValue = null) {
    if (typeof gtag === 'function') {
        const eventData = {
            event_category: eventCategory
        };
        if (eventLabel !== null) eventData.event_label = eventLabel;
        if (eventValue !== null) eventData.value = eventValue;

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
        <div id="${toastId}" class="toast feedback-toast border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex align-items-stretch">
                <div class="feedback-toast__sigil" aria-hidden="true">
                    <i class="fas fa-scroll"></i>
                </div>
                <div class="toast-body feedback-toast__body">
                    <span class="feedback-toast__title">Event deck notice</span>
                    <span class="feedback-toast__message">${message}</span>
                </div>
                <button type="button" class="themed-close me-2 my-auto" data-bs-dismiss="toast" aria-label="Dismiss notification">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
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
