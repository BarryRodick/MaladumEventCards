/**
 * Test suite for app snapshot helpers
 * Run with: node tests/appSnapshot.test.js
 */
const assert = require('assert');
const { loadSourceModule } = require('./helpers/load-source-module');

function loadAppSnapshot() {
    const { rebuildSelectedCardsMap } = loadSourceModule('live-deck.js', {
        exports: ['rebuildSelectedCardsMap']
    });

    return loadSourceModule('app-snapshot.js', {
        dependencies: { rebuildSelectedCardsMap },
        exports: [
            'captureConfigurationSnapshot',
            'restoreBasicConfigSnapshot',
            'hydrateDeckState'
        ]
    });
}

console.log('Testing app snapshot helpers...');

{
    const { captureConfigurationSnapshot } = loadAppSnapshot();
    const appState = {
        selectedGames: ['Maladum'],
        enableSentryRules: true,
        enableCorrupterRules: false,
        selectedDifficultyIndex: 2,
        currentDeck: [{ id: 1, card: 'A' }],
        currentIndex: 0,
        discardPile: [],
        sentryDeck: [{ id: 2, card: 'Sentry' }],
        initialDeckSize: 1,
        inPlayCards: [],
        isActiveCardCleared: false,
        deck: {
            main: [{ id: 1, card: 'A' }],
            special: [],
            combined: [{ id: 1, card: 'A' }]
        }
    };

    const snapshot = captureConfigurationSnapshot(appState, {
        cardCounts: { Denizen: 1 },
        specialCardCounts: { Revenant: 1 }
    });

    assert.deepStrictEqual(snapshot.selectedGames, ['Maladum']);
    assert.deepStrictEqual(snapshot.cardCounts, { Denizen: 1 });
    assert.deepStrictEqual(snapshot.specialCardCounts, { Revenant: 1 });
    assert.deepStrictEqual(snapshot.deckState.currentDeck, appState.currentDeck);
    assert.deepStrictEqual(snapshot.deckState.sentryDeck, appState.sentryDeck);
}

{
    const { restoreBasicConfigSnapshot, hydrateDeckState } = loadAppSnapshot();
    const appState = {
        selectedGames: [],
        enableSentryRules: false,
        enableCorrupterRules: false,
        selectedDifficultyIndex: 0,
        cardCounts: {},
        specialCardCounts: {},
        currentDeck: [],
        discardPile: [],
        sentryDeck: [],
        inPlayCards: [],
        deck: {
            main: [],
            special: [],
            combined: []
        },
        cards: {
            selected: new Map([['stale', true]])
        }
    };

    restoreBasicConfigSnapshot(appState, {
        selectedGames: ['Dungeons of Enveron'],
        enableSentryRules: true,
        selectedDifficultyIndex: 3,
        cardCounts: { Novice: 2 }
    });

    assert.deepStrictEqual(appState.selectedGames, ['Dungeons of Enveron']);
    assert.strictEqual(appState.enableSentryRules, true);
    assert.strictEqual(appState.enableCorrupterRules, false);
    assert.strictEqual(appState.selectedDifficultyIndex, 3);
    assert.deepStrictEqual(appState.cardCounts, { Novice: 2 });

    const card = { id: 42, card: 'Restored' };
    const hydration = hydrateDeckState(appState, {
        currentDeck: [card],
        currentIndex: 0,
        discardPile: [],
        sentryDeck: [],
        inPlayCards: [],
        mainDeck: [card],
        specialDeck: [],
        combinedDeck: [card]
    });

    assert.strictEqual(hydration.hasActiveDeck, true);
    assert.strictEqual(appState.cards.selected.has('stale'), false);
    assert.strictEqual(appState.cards.selected.has(42), true);
}

console.log('All app snapshot tests passed!');
