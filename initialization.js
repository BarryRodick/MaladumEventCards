/**
 * initialization.js - Handles application startup and initialization
 */
import { state } from './state.js';
import { trackEvent, showToast } from './app-utils.js';
import { loadSavedConfig, restoreBasicConfig } from './config-manager.js';
import { generateGameSelection, populateDifficultySelection, loadCardTypes, initializeDeckFlowUI } from './ui-manager.js';
import { liveDeckSession } from './live-deck-session.js';
import { setupUpdateNotifications } from './update-utils.js';
import { hydrateDeckState } from './app-snapshot.js';
import { acquireCardCatalog } from './card-catalog.js';

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

    const catalogResult = await acquireCardCatalog();
    reportCatalogDiagnostics(catalogResult.diagnostics);
    if (catalogResult.status === 'unavailable') {
        showToast('Failed to load game data. Please check your connection.');
    } else {
        applyCardCatalog(catalogResult);
        if (catalogResult.status === 'offline') {
            showToast('Using cached offline data.');
        }
    }

    // 4. Finalize Setup
    if (state.dataStore && state.dataStore.games) {
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

function applyCardCatalog({ catalog, difficulties, cardIndex }) {
    state.dataStore = catalog;
    state.iconRegistry = catalog.icons || {};
    state.cardManifest = catalog.cardManifest || null;
    state.difficultySettings = difficulties;
    state.cardMap = cardIndex;
}

function reportCatalogDiagnostics(diagnostics = []) {
    diagnostics.forEach(({ level, message, error }) => {
        const log = level === 'error' ? console.error : console.warn;
        if (error) {
            log(message, error);
            return;
        }
        log(message);
    });
}

function restoreDeckState(deckState) {
    const hydration = hydrateDeckState(state, deckState);

    if (hydration.hasActiveDeck) {
        const activeDeckSection = document.getElementById('activeDeckSection');
        if (activeDeckSection) activeDeckSection.style.display = 'block';

        document.getElementById('navigationButtons').style.display = 'grid';
        document.getElementById('deckProgress').style.display = 'block';
        document.getElementById('cardActionSection').style.display = 'block';

        liveDeckSession.present();
    }
}
