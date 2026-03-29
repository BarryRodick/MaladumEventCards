/**
 * storage-utils.js - ES module providing persistence helpers
 */

export function isStorageAvailable() {
    try {
        const test = '__storage_test__';
        window.localStorage.setItem(test, test);
        window.localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

export function saveState(key, state) {
    if (!isStorageAvailable()) {
        console.warn('Local storage is not available');
        return false;
    }
    try {
        window.localStorage.setItem(key, JSON.stringify(state));
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            console.error('Storage quota exceeded:', e);
            return false;
        }
        console.warn('Error saving state:', e);
        return false;
    }
}

export function loadState(key) {
    if (!isStorageAvailable()) {
        console.warn('Local storage is not available');
        return null;
    }
    try {
        const saved = window.localStorage.getItem(key);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        console.warn('Error loading state:', e);
        return null;
    }
}
