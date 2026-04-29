/**
 * deck-flow-utils.js - Pure helpers for the Build/Play deck experience
 */

export function deriveDeckMode({ currentDeckLength = 0, requestedMode = null } = {}) {
    if (requestedMode === 'build') {
        return 'build';
    }

    if (requestedMode === 'play') {
        return currentDeckLength > 0 ? 'play' : 'build';
    }

    return currentDeckLength > 0 ? 'play' : 'build';
}

function formatSelectedGames(selectedGames = []) {
    if (selectedGames.length === 0) {
        return 'No games selected';
    }

    if (selectedGames.length === 1) {
        return selectedGames[0];
    }

    if (selectedGames.length === 2) {
        return `${selectedGames[0]} + ${selectedGames[1]}`;
    }

    return `${selectedGames[0]} + ${selectedGames.length - 1} more`;
}

export function formatDeckSummary({
    selectedGames = [],
    difficultyName = '',
    enableSentryRules = false,
    enableCorrupterRules = false,
    currentDeckLength = 0,
    currentIndex = -1,
    discardPileLength = 0,
    currentCardName = ''
} = {}) {
    const remainingCount = Math.max(0, currentDeckLength - Math.max(0, currentIndex + 1));
    const gamesText = formatSelectedGames(selectedGames);
    const difficultyText = difficultyName || 'Custom difficulty';
    const statusText = currentIndex === -1
        ? 'Ready to draw'
        : (currentCardName || `Card ${currentIndex + 1}`);

    return {
        gamesText,
        difficultyText,
        remainingCount,
        discardCount: Math.max(0, discardPileLength),
        statusText,
        showSentryBadge: !!enableSentryRules,
        showCorrupterBadge: !!enableCorrupterRules
    };
}

export function getGenerateDeckState({
    selectedGames = [],
    cardCounts = {},
    sentryTypes = [],
    corrupterTypes = [],
    enableSentryRules = false,
    enableCorrupterRules = false,
    hasActiveDeck = false
} = {}) {
    const hasSelectedGames = selectedGames.length > 0;
    const hasConfiguredCards = Object.entries(cardCounts).some(([type, rawCount]) => {
        const count = Math.max(0, parseInt(rawCount, 10) || 0);
        if (count <= 0) {
            return false;
        }

        if (sentryTypes.includes(type)) {
            return !!enableSentryRules;
        }

        if (corrupterTypes.includes(type)) {
            return !!enableCorrupterRules;
        }

        return true;
    });
    const canGenerate = hasSelectedGames && hasConfiguredCards;

    return {
        canGenerate,
        hasSelectedGames,
        hasConfiguredCards,
        label: canGenerate
            ? (hasActiveDeck ? 'Rebuild Deck' : 'Generate Deck')
            : 'Choose Card Counts'
    };
}

export function buildPreviewActionRequest(actionName, modalData = {}, extras = {}) {
    if (!modalData.cardId) {
        return null;
    }

    if (actionName === 'shuffleTopN') {
        return {
            kind: 'shuffleTopN',
            cardId: modalData.cardId,
            count: Math.max(1, parseInt(extras.count, 10) || 1)
        };
    }

    if (actionName === 'insertNext') {
        return {
            kind: 'insertSpecificCard',
            cardId: modalData.cardId,
            position: 'next'
        };
    }

    if (actionName === 'addToBottom') {
        return {
            kind: 'insertSpecificCard',
            cardId: modalData.cardId,
            position: 'bottom'
        };
    }

    return null;
}
