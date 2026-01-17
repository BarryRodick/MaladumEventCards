/**
 * dom-utils.js - ES module providing DOM manipulation helpers
 */

export function getEl(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.error(`Element with ID "${id}" not found.`);
    }
    return el;
}

export function addEvent(id, event, handler) {
    const el = getEl(id);
    if (el) {
        el.addEventListener(event, handler);
    }
}
