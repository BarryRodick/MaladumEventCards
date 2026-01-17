/**
 * initialization.js - Handles application startup and initialization
 */
import { state, CONFIG } from './state.js';
import { trackEvent, showToast } from './app-utils.js';
import { loadSavedConfig, restoreBasicConfig } from './config-manager.js';
import { generateGameSelection, populateDifficultySelection, loadCardTypes, updateDifficultyDetails } from './ui-manager.js';
import { showCurrentCard, updateProgressBar } from './deck-manager.js';
import { updateInPlayCardsDisplay } from './card-actions.js';
import { showUpdateNotification } from './update-utils.js';

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

    // 3. Fetch Data
    try {
        const [cardsData, difficultiesData] = await Promise.all([
            fetch('maladumcards.json').then(r => r.json()),
            fetch('difficulties.json').then(r => r.json())
        ]);

        state.dataStore = cardsData;
        state.difficultySettings = difficultiesData.difficulties || [];

        // Cache for offline use
        localStorage.setItem('cachedCardsData', JSON.stringify(cardsData));
        localStorage.setItem('cachedDifficultiesData', JSON.stringify(difficultiesData));

    } catch (error) {
        console.warn('Fetch failed, trying cache:', error);
        const cachedCards = localStorage.getItem('cachedCardsData');
        const cachedDiffs = localStorage.getItem('cachedDifficultiesData');

        if (cachedCards && cachedDiffs) {
            state.dataStore = JSON.parse(cachedCards);
            state.difficultySettings = JSON.parse(cachedDiffs).difficulties || [];
            showToast('Using cached offline data.');
        } else {
            console.error('No cached data available:', error);
            showToast('Failed to load game data. Please check your connection.');
        }
    }

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

            // Restore deck state if it exists
            if (savedConfig && savedConfig.deckState) {
                restoreDeckState(savedConfig.deckState);
            }
        }
    }

    setupServiceWorker();
    trackEvent('App', 'Initialize', 'Maladum Event Cards');
}

function restoreDeckState(deckState) {
    state.currentDeck = deckState.currentDeck || [];
    state.currentIndex = deckState.currentIndex || -1;
    state.discardPile = deckState.discardPile || [];
    state.sentryDeck = deckState.sentryDeck || [];
    state.initialDeckSize = deckState.initialDeckSize || 0;
    state.inPlayCards = deckState.inPlayCards || [];

    if (state.currentDeck.length > 0) {
        const activeDeckSection = document.getElementById('activeDeckSection');
        if (activeDeckSection) activeDeckSection.style.display = 'block';

        document.getElementById('navigationButtons').style.display = 'block';
        document.getElementById('deckProgress').style.display = 'block';
        document.getElementById('cardActionSection').style.display = 'block';

        showCurrentCard();
        updateProgressBar();
        updateInPlayCardsDisplay();
    }
}

function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => {
                reg.onupdatefound = () => {
                    const installingWorker = reg.installing;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showUpdateNotification();
                        }
                    };
                };
            });

        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data.type === 'NEW_VERSION') {
                showUpdateNotification(event.data.version);
            }
        });
    }
}
