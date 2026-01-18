/**
 * config-manager.js - Handles persistence of application configuration and state
 */
import { state, CONFIG, cardTypeId } from './state.js';
import { saveState, loadState, isStorageAvailable } from './storage-utils.js';
import { trackEvent } from './app-utils.js';

/**
 * Saves the current application configuration and deck state to local storage
 */
export function saveConfiguration() {
    if (!isStorageAvailable()) {
        console.warn('Storage is not available, configuration will not be saved');
        return;
    }

    try {
        const config = {
            selectedGames: state.selectedGames,
            cardCounts: {},
            specialCardCounts: {},
            enableSentryRules: state.enableSentryRules,
            enableCorrupterRules: state.enableCorrupterRules,
            selectedDifficultyIndex: state.selectedDifficultyIndex,
            deckState: {
                currentDeck: state.currentDeck,
                currentIndex: state.currentIndex,
                discardPile: state.discardPile,
                sentryDeck: state.sentryDeck,
                initialDeckSize: state.initialDeckSize,
                inPlayCards: state.inPlayCards,
                mainDeck: state.deck.main,
                specialDeck: state.deck.special,
                combinedDeck: state.deck.combined
            }
        };

        // Gather card counts from the state/DOM
        state.allCardTypes.forEach(type => {
            const input = document.getElementById(cardTypeId(type));
            if (input) {
                const count = parseInt(input.value) || 0;
                if ((state.dataStore.sentryTypes.includes(type) && state.enableSentryRules) ||
                    (state.dataStore.corrupterTypes.includes(type) && state.enableCorrupterRules)) {
                    config.specialCardCounts[type] = count;
                } else {
                    config.cardCounts[type] = count;
                }
            }
        });

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
    if (!savedConfig) return;

    if (savedConfig.selectedGames) {
        state.selectedGames = savedConfig.selectedGames;
    }

    state.enableSentryRules = savedConfig.enableSentryRules || false;
    state.enableCorrupterRules = savedConfig.enableCorrupterRules || false;
    state.selectedDifficultyIndex = savedConfig.selectedDifficultyIndex || 0;
    state.cardCounts = savedConfig.cardCounts || {};
    state.specialCardCounts = savedConfig.specialCardCounts || {};
}
