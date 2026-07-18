import { rebuildSelectedCardsMap } from './live-deck.js';

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function toRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function resolveSavedCard(appState, savedCard, collectionName) {
    if (!savedCard || typeof savedCard !== 'object' || savedCard.id === undefined) {
        return savedCard;
    }

    const cardMap = appState.cardMap;
    if (!(cardMap instanceof Map)) {
        return savedCard;
    }

    const numericId = Number(savedCard.id);
    if (Number.isFinite(numericId) && cardMap.has(numericId)) {
        return cardMap.get(numericId);
    }

    if (cardMap.has(savedCard.id)) {
        return cardMap.get(savedCard.id);
    }

    console.warn(`Saved ${collectionName} card ${savedCard.id} is missing from the current catalog; using saved fallback.`);
    return savedCard;
}

function hydrateCardCollection(appState, value, collectionName) {
    return toArray(value).map(card => resolveSavedCard(appState, card, collectionName));
}

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

    if (Object.prototype.hasOwnProperty.call(savedConfig, 'selectedGames')) {
        appState.selectedGames = toArray(savedConfig.selectedGames);
    }

    appState.enableSentryRules = savedConfig.enableSentryRules === true;
    appState.enableCorrupterRules = savedConfig.enableCorrupterRules === true;
    appState.selectedDifficultyIndex = Number.isInteger(savedConfig.selectedDifficultyIndex)
        ? savedConfig.selectedDifficultyIndex
        : 0;
    appState.cardCounts = toRecord(savedConfig.cardCounts);
    appState.specialCardCounts = toRecord(savedConfig.specialCardCounts);
}

export function hydrateDeckState(appState, deckState = {}) {
    const snapshot = toRecord(deckState);
    appState.currentDeck = hydrateCardCollection(appState, snapshot.currentDeck, 'currentDeck');
    appState.currentIndex = Number.isInteger(snapshot.currentIndex) ? snapshot.currentIndex : -1;
    appState.discardPile = hydrateCardCollection(appState, snapshot.discardPile, 'discardPile');
    appState.sentryDeck = hydrateCardCollection(appState, snapshot.sentryDeck, 'sentryDeck');
    appState.initialDeckSize = Number.isFinite(snapshot.initialDeckSize) && snapshot.initialDeckSize >= 0
        ? snapshot.initialDeckSize
        : 0;
    appState.inPlayCards = hydrateCardCollection(appState, snapshot.inPlayCards, 'inPlayCards');
    appState.isActiveCardCleared = snapshot.isActiveCardCleared === true;

    appState.deck = toRecord(appState.deck);
    appState.deck.main = hydrateCardCollection(appState, snapshot.mainDeck, 'mainDeck');
    appState.deck.special = hydrateCardCollection(appState, snapshot.specialDeck, 'specialDeck');
    const combinedDeck = hydrateCardCollection(appState, snapshot.combinedDeck, 'combinedDeck');
    appState.deck.combined = combinedDeck.length > 0 ? combinedDeck : appState.currentDeck;

    appState.cards = toRecord(appState.cards);

    rebuildSelectedCardsMap(appState);

    return {
        hasActiveDeck: appState.currentDeck.length > 0
    };
}
