import { rebuildSelectedCardsMap } from './live-deck.js';

export function captureConfigurationSnapshot(appState, {
    cardCounts = {},
    specialCardCounts = {}
} = {}) {
    return {
        selectedGames: appState.selectedGames,
        cardCounts,
        specialCardCounts,
        enableSentryRules: appState.enableSentryRules,
        enableCorrupterRules: appState.enableCorrupterRules,
        selectedDifficultyIndex: appState.selectedDifficultyIndex,
        deckState: {
            currentDeck: appState.currentDeck,
            currentIndex: appState.currentIndex,
            discardPile: appState.discardPile,
            sentryDeck: appState.sentryDeck,
            initialDeckSize: appState.initialDeckSize,
            inPlayCards: appState.inPlayCards,
            isActiveCardCleared: appState.isActiveCardCleared,
            mainDeck: appState.deck.main,
            specialDeck: appState.deck.special,
            combinedDeck: appState.deck.combined
        }
    };
}

export function restoreBasicConfigSnapshot(appState, savedConfig) {
    if (!savedConfig) return;

    if (savedConfig.selectedGames) {
        appState.selectedGames = savedConfig.selectedGames;
    }

    appState.enableSentryRules = savedConfig.enableSentryRules || false;
    appState.enableCorrupterRules = savedConfig.enableCorrupterRules || false;
    appState.selectedDifficultyIndex = savedConfig.selectedDifficultyIndex || 0;
    appState.cardCounts = savedConfig.cardCounts || {};
    appState.specialCardCounts = savedConfig.specialCardCounts || {};
}

export function hydrateDeckState(appState, deckState = {}) {
    appState.currentDeck = deckState.currentDeck || [];
    appState.currentIndex = deckState.currentIndex ?? -1;
    appState.discardPile = deckState.discardPile || [];
    appState.sentryDeck = deckState.sentryDeck || [];
    appState.initialDeckSize = deckState.initialDeckSize || 0;
    appState.inPlayCards = deckState.inPlayCards || [];
    appState.isActiveCardCleared = deckState.isActiveCardCleared || false;
    appState.deck.main = deckState.mainDeck || [];
    appState.deck.special = deckState.specialDeck || [];
    appState.deck.combined = deckState.combinedDeck || appState.currentDeck;

    rebuildSelectedCardsMap(appState);

    return {
        hasActiveDeck: appState.currentDeck.length > 0
    };
}
