/**
 * state.js - Central application state
 */

export const CONFIG = {
    deck: {
        sentry: {
            defaultCount: 4,
            minCount: 3,
            maxCount: 5
        },
        corrupter: {
            defaultCount: 5,
            minCount: 3,
            maxCount: 7,
            preferredDeckSection: 'middle'
        }
    },
    storage: {
        key: 'savedConfig',
        testKey: '__storage_test__'
    },
    DEBUG: false
};

// Application state
export const state = {
    // Card data
    dataStore: {
        games: {},
        sentryTypes: [],
        corrupterTypes: [],
        heldBackCardTypes: []
    },
    difficultySettings: [],
    cardMap: new Map(),
    deckDataByType: {},
    availableCards: [],

    // Selection state
    allGames: [],
    selectedGames: [],
    allCardTypes: [],
    selectedDifficultyIndex: 0,
    cardCounts: {},
    specialCardCounts: {},

    // Card selection map
    cards: {
        selected: new Map()
    },

    // Deck state
    currentDeck: [],
    deck: {
        main: [],
        special: [],
        combined: []
    },
    currentIndex: -1,
    discardPile: [],
    sentryDeck: [],
    inPlayCards: [],
    setAsideCards: [],
    initialDeckSize: 0,

    // Rules
    enableSentryRules: false,
    enableCorrupterRules: false,

    // Helpers
    deferredDeckRestoration: null
};

// Helper function to slugify text
export function slugify(text) {
    return text.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

export function cardTypeId(type) {
    return `type-${slugify(type)}`;
}

// Global variable for easier debugging during transition
if (typeof window !== 'undefined') {
    window.appState = state;
}
