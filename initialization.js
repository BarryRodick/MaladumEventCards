/**
 * initialization.js - Handles application startup and initialization
 */
import { state } from './state.js';
import { trackEvent, showToast } from './app-utils.js';
import { loadSavedConfig, restoreBasicConfig } from './config-manager.js';
import { generateGameSelection, populateDifficultySelection, loadCardTypes, initializeDeckFlowUI } from './ui-manager.js';
import { showCurrentCard, updateProgressBar } from './deck-manager.js';
import { updateInPlayCardsDisplay } from './card-actions.js';
import { setupUpdateNotifications } from './update-utils.js';
import { saveState, loadState } from './storage-utils.js';

const CACHE_KEYS = {
    cards: 'cachedCardsData',
    difficulties: 'cachedDifficultiesData'
};

/**
 * Initializes the application
 */
export async function initializeApp() {
    // 1. Initial State Setup
    state.dataStore = {
        games: {},
        sentryTypes: [],
        corrupterTypes: [],
        heldBackCardTypes: []
    };

    // 2. Load Saved Config
    const savedConfig = loadSavedConfig();
    if (savedConfig) {
        restoreBasicConfig(savedConfig);
    }

    await loadGameData();

    // 4. Finalize Setup
    if (state.dataStore && state.dataStore.games) {
        // Build card map
        state.cardMap.clear();
        Object.keys(state.dataStore.games).forEach(game => {
            state.dataStore.games[game].forEach(card => {
                state.cardMap.set(card.id, card);
            });
        });

        // Setup expansion info
        state.allGames = Object.keys(state.dataStore.games);

        if (state.allGames.length > 0) {
            // UI Initialization
            generateGameSelection(state.allGames);
            populateDifficultySelection();
            loadCardTypes();

            // Sync checkboxes and difficulty selection to restored state
            const sentryCheckbox = document.getElementById('enableSentryRules');
            if (sentryCheckbox) sentryCheckbox.checked = state.enableSentryRules;

            const corrupterCheckbox = document.getElementById('enableCorrupterRules');
            if (corrupterCheckbox) corrupterCheckbox.checked = state.enableCorrupterRules;

            const difficultySelect = document.getElementById('difficultyLevel');
            if (difficultySelect) difficultySelect.selectedIndex = state.selectedDifficultyIndex;

            // Restore deck state if it exists
            if (savedConfig && savedConfig.deckState) {
                restoreDeckState(savedConfig.deckState);
            }

            initializeDeckFlowUI({
                hasSavedConfig: !!savedConfig,
                hasActiveDeck: state.currentDeck.length > 0
            });
        }
    }

    setupUpdateNotifications();
    trackEvent('App', 'Initialize', 'Maladum Event Cards');
}

async function loadGameData() {
    try {
        const [cardsData, difficultiesData] = await Promise.all([
            fetch('maladumcards.json').then(r => r.json()),
            fetch('difficulties.json').then(r => r.json())
        ]);

        state.dataStore = cardsData;
        state.difficultySettings = difficultiesData.difficulties || [];
        cacheFetchedData(cardsData, difficultiesData);
    } catch (error) {
        console.warn('Fetch failed, trying cache:', error);
        if (loadCachedData()) {
            showToast('Using cached offline data.');
            return;
        }

        console.error('No cached data available:', error);
        showToast('Failed to load game data. Please check your connection.');
    }
}

function cacheFetchedData(cardsData, difficultiesData) {
    const cardsCached = saveState(CACHE_KEYS.cards, cardsData);
    const difficultiesCached = saveState(CACHE_KEYS.difficulties, difficultiesData);

    if (!cardsCached || !difficultiesCached) {
        console.warn('Unable to cache fetched game data for offline use.');
    }
}

function loadCachedData() {
    const cachedCards = loadState(CACHE_KEYS.cards);
    const cachedDiffs = loadState(CACHE_KEYS.difficulties);

    if (!cachedCards || !cachedDiffs) {
        return false;
    }

    state.dataStore = cachedCards;
    state.difficultySettings = cachedDiffs.difficulties || [];
    return true;
}

function restoreDeckState(deckState) {
    state.currentDeck = deckState.currentDeck || [];
    state.currentIndex = deckState.currentIndex ?? -1;
    state.discardPile = deckState.discardPile || [];
    state.sentryDeck = deckState.sentryDeck || [];
    state.initialDeckSize = deckState.initialDeckSize || 0;
    state.inPlayCards = deckState.inPlayCards || [];
    state.isActiveCardCleared = deckState.isActiveCardCleared || false;
    state.deck.main = deckState.mainDeck || [];
    state.deck.special = deckState.specialDeck || [];
    state.deck.combined = deckState.combinedDeck || state.currentDeck;
    if (!state.cards || !state.cards.selected) {
        state.cards = { selected: new Map() };
    } else {
        state.cards.selected.clear();
    }

    const selectedCards = [
        ...state.currentDeck,
        ...state.discardPile,
        ...state.sentryDeck,
        ...state.inPlayCards
    ];
    selectedCards.forEach(card => {
        if (card && card.id !== undefined) {
            state.cards.selected.set(card.id, true);
        }
    });

    if (state.currentDeck.length > 0) {
        const activeDeckSection = document.getElementById('activeDeckSection');
        if (activeDeckSection) activeDeckSection.style.display = 'block';

        document.getElementById('navigationButtons').style.display = 'flex';
        document.getElementById('deckProgress').style.display = 'block';
        document.getElementById('cardActionSection').style.display = 'block';

        showCurrentCard();
        updateProgressBar();
        updateInPlayCardsDisplay();
    }
}
