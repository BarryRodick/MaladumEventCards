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
    const toastElement = document.createElement('div');
    toastElement.id = toastId;
    toastElement.className = 'toast feedback-toast border-0';
    toastElement.setAttribute('role', 'alert');
    toastElement.setAttribute('aria-live', 'assertive');
    toastElement.setAttribute('aria-atomic', 'true');

    const layout = document.createElement('div');
    layout.className = 'd-flex align-items-stretch';

    const sigil = document.createElement('div');
    sigil.className = 'feedback-toast__sigil';
    sigil.setAttribute('aria-hidden', 'true');
    const sigilIcon = document.createElement('i');
    sigilIcon.className = 'fas fa-scroll';
    sigil.appendChild(sigilIcon);

    const body = document.createElement('div');
    body.className = 'toast-body feedback-toast__body';
    const title = document.createElement('span');
    title.className = 'feedback-toast__title';
    title.textContent = 'Event deck notice';
    const messageNode = document.createElement('span');
    messageNode.className = 'feedback-toast__message';
    messageNode.textContent = String(message ?? '');
    body.append(title, messageNode);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'themed-close me-2 my-auto';
    closeButton.setAttribute('data-bs-dismiss', 'toast');
    closeButton.setAttribute('aria-label', 'Dismiss notification');
    const closeIcon = document.createElement('i');
    closeIcon.className = 'fas fa-times';
    closeIcon.setAttribute('aria-hidden', 'true');
    closeButton.appendChild(closeIcon);

    layout.append(sigil, body, closeButton);
    toastElement.appendChild(layout);
    toastContainer.appendChild(toastElement);

    if (typeof bootstrap !== 'undefined') {
        const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
        toast.show();

        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
}
