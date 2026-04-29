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
import { mergeCardCatalogs } from './card-data.mjs';

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
        heldBackCardTypes: [],
        icons: {},
        cardManifest: null
    };
    state.iconRegistry = {};
    state.cardManifest = null;

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
        const [legacyCardsData, difficultiesData, richCardsData] = await Promise.all([
            fetchJson('maladumcards.json'),
            fetchJson('difficulties.json'),
            loadRichCardsData().catch(error => {
                console.warn('Structured card catalog unavailable, continuing with legacy image cards:', error);
                return null;
            })
        ]);

        const cardsData = mergeCardCatalogs(legacyCardsData, richCardsData);

        state.dataStore = cardsData;
        state.iconRegistry = cardsData.icons || {};
        state.cardManifest = cardsData.cardManifest || null;
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
    state.iconRegistry = cachedCards.icons || {};
    state.cardManifest = cachedCards.cardManifest || null;
    state.difficultySettings = cachedDiffs.difficulties || [];
    return true;
}

async function fetchJson(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.status}`);
    }
    return response.json();
}

async function loadRichCardsData() {
    const manifest = await fetchJson('data/cards/manifest.json');
    const [icons, richGameEntries] = await Promise.all([
        fetchJson('data/cards/icons.json'),
        Promise.all(
            Object.entries(manifest.games || {}).map(async ([gameName, path]) => {
                const payload = await fetchJson(path);
                return [gameName, payload];
            })
        )
    ]);

    return {
        manifest,
        icons,
        games: Object.fromEntries(richGameEntries)
    };
}

function restoreDeckState(deckState) {
    function resolveSavedCard(savedCard, collectionName) {
        if (!savedCard || savedCard.id === undefined || !(state.cardMap instanceof Map)) {
            return savedCard;
        }

        const numericId = Number(savedCard.id);
        if (Number.isFinite(numericId) && state.cardMap.has(numericId)) {
            return state.cardMap.get(numericId);
        }

        if (state.cardMap.has(savedCard.id)) {
            return state.cardMap.get(savedCard.id);
        }

        console.warn(`Saved ${collectionName} card ${savedCard.id} is missing from the current catalog; using saved fallback.`);
        return savedCard;
    }

    function resolveSavedCards(cards, collectionName) {
        return (cards || []).map(card => resolveSavedCard(card, collectionName));
    }

    state.currentDeck = resolveSavedCards(deckState.currentDeck, 'currentDeck');
    state.currentIndex = deckState.currentIndex ?? -1;
    state.discardPile = resolveSavedCards(deckState.discardPile, 'discardPile');
    state.sentryDeck = resolveSavedCards(deckState.sentryDeck, 'sentryDeck');
    state.initialDeckSize = deckState.initialDeckSize || 0;
    state.inPlayCards = resolveSavedCards(deckState.inPlayCards, 'inPlayCards');
    state.deck.main = resolveSavedCards(deckState.mainDeck, 'mainDeck');
    state.deck.special = resolveSavedCards(deckState.specialDeck, 'specialDeck');
    state.deck.combined = resolveSavedCards(deckState.combinedDeck, 'combinedDeck');
    if (state.deck.combined.length === 0) {
        state.deck.combined = state.currentDeck;
    }
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
