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

const CATALOG_STARTUP_COPY = {
    loading: {
        title: 'Loading Card Catalog',
        message: 'Checking the latest card sources and your saved recovery copy.'
    },
    partial: {
        title: 'Using limited Card Catalog data',
        message: 'Some enhanced card sources did not load. You can keep using this safe session data, or reconnect and choose Retry.'
    },
    offline: {
        title: 'Using saved Card Catalog data',
        message: 'The latest card sources were unavailable or lower quality. You can keep building with the last-known-good copy, or reconnect and choose Retry.'
    },
    error: {
        title: 'Card Catalog unavailable',
        message: 'Check your connection, then choose Retry. A first visit needs a connection before you can build a deck.'
    }
};

function renderCatalogStartupState(startupState) {
    const status = document.getElementById('catalogStatus');
    const title = document.getElementById('catalogStatusTitle');
    const message = document.getElementById('catalogStatusMessage');
    const retry = document.getElementById('catalogRetry');
    const deckExperience = document.getElementById('deckExperience');
    const ready = startupState === 'ready';
    const usable = ready || startupState === 'partial' || startupState === 'offline';

    if (status) {
        status.hidden = ready;
        status.dataset.state = startupState;
        status.setAttribute?.('role', startupState === 'error' ? 'alert' : 'status');
    }
    if (!ready && title) title.textContent = CATALOG_STARTUP_COPY[startupState].title;
    if (!ready && message) message.textContent = CATALOG_STARTUP_COPY[startupState].message;
    if (retry) {
        retry.hidden = !['partial', 'offline', 'error'].includes(startupState);
        retry.disabled = startupState === 'loading';
    }
    if (deckExperience) deckExperience.hidden = !usable;
}

/**
 * Initializes the application
 */
export const initializeApp = async function initializeApp() {
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

    let retryInProgress = false;
    const loadCatalogForStartup = async () => {
        renderCatalogStartupState('loading');
        let catalogResult;
        try {
            catalogResult = await acquireCardCatalog();
        } catch (error) {
            catalogResult = {
                status: 'unavailable',
                catalog: null,
                difficulties: [],
                cardIndex: new Map(),
                diagnostics: [{
                    level: 'error',
                    message: 'Unexpected Card Catalog acquisition failure:',
                    error
                }]
            };
        }
        reportCatalogDiagnostics(catalogResult.diagnostics);

        if (catalogResult.status === 'unavailable') {
            renderCatalogStartupState('error');
            showToast('Failed to load game data. Please check your connection.');
            return catalogResult;
        }

        applyCardCatalog(catalogResult);
        initializeCatalogUI(savedConfig);

        if (catalogResult.status === 'offline') {
            renderCatalogStartupState('offline');
            showToast('Using cached offline data.');
        } else if (catalogResult.status === 'partial') {
            renderCatalogStartupState('partial');
        } else {
            renderCatalogStartupState('ready');
        }

        return catalogResult;
    };
    const retryCatalog = async () => {
        if (retryInProgress) return null;
        retryInProgress = true;
        try {
            return await loadCatalogForStartup();
        } finally {
            retryInProgress = false;
        }
    };
    const retryButton = document.getElementById('catalogRetry');
    if (retryButton) retryButton.onclick = retryCatalog;

    const catalogResult = await loadCatalogForStartup();

    setupUpdateNotifications();
    trackEvent('App', 'Initialize', 'Maladum Event Cards');
    return catalogResult;
};

function initializeCatalogUI(savedConfig) {
    if (!state.dataStore?.games) return;

    state.allGames = Object.keys(state.dataStore.games);
    if (state.allGames.length === 0) return;

    generateGameSelection(state.allGames);
    populateDifficultySelection();
    loadCardTypes();

    const sentryCheckbox = document.getElementById('enableSentryRules');
    if (sentryCheckbox) sentryCheckbox.checked = state.enableSentryRules;

    const corrupterCheckbox = document.getElementById('enableCorrupterRules');
    if (corrupterCheckbox) corrupterCheckbox.checked = state.enableCorrupterRules;

    const difficultySelect = document.getElementById('difficultyLevel');
    if (difficultySelect) difficultySelect.selectedIndex = state.selectedDifficultyIndex;

    if (savedConfig?.deckState) {
        restoreDeckState(savedConfig.deckState);
    }

    initializeDeckFlowUI({
        hasSavedConfig: !!savedConfig,
        hasActiveDeck: state.currentDeck.length > 0
    });
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
