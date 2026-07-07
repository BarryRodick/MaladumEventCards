/**
 * config-manager.js - Handles persistence of application configuration and state
 */
import { state, CONFIG, cardTypeId } from './state.js';
import { saveState, loadState, isStorageAvailable } from './storage-utils.js';
import { trackEvent } from './app-utils.js';
import { captureConfigurationSnapshot, restoreBasicConfigSnapshot } from './app-snapshot.js';

/**
 * Saves the current application configuration and deck state to local storage
 */
export function saveConfiguration() {
    if (!isStorageAvailable()) {
        console.warn('Storage is not available, configuration will not be saved');
        return;
    }

    try {
        const config = captureConfigurationSnapshot(state, collectConfiguredCardCounts());

        saveState(CONFIG.storage.key, config);

        if (CONFIG.DEBUG) console.log('Game state saved:', {
            deckSize: state.currentDeck.length,
            currentIndex: state.currentIndex
        });

        if (state.currentDeck.length > 0) {
            trackEvent('App State', 'Save Configuration', null, state.currentDeck.length);
        }
    } catch (e) {
        console.warn('Error saving configuration:', e);
    }
}

/**
 * Loads the application configuration from local storage
 */
export function loadSavedConfig() {
    return loadState(CONFIG.storage.key);
}

/**
 * Restores the basic selection state (games, counts, rules) but not the deck itself
 */
export function restoreBasicConfig(savedConfig) {
    restoreBasicConfigSnapshot(state, savedConfig);
}

function collectConfiguredCardCounts() {
    const cardCounts = {};
    const specialCardCounts = {};

    state.allCardTypes.forEach(type => {
        const input = document.getElementById(cardTypeId(type));
        if (!input) return;

        const count = parseInt(input.value) || 0;
        if ((state.dataStore.sentryTypes.includes(type) && state.enableSentryRules) ||
            (state.dataStore.corrupterTypes.includes(type) && state.enableCorrupterRules)) {
            specialCardCounts[type] = count;
        } else {
            cardCounts[type] = count;
        }
    });

    return { cardCounts, specialCardCounts };
}
