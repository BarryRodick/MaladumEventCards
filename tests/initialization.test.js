/**
 * Test suite for initialization helpers
 * Run with: node tests/initialization.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadSourceModule } = require('./helpers/load-source-module');

function loadHydrateDeckState() {
    const { rebuildSelectedCardsMap } = loadSourceModule('live-deck.js', {
        exports: ['rebuildSelectedCardsMap']
    });

    return loadSourceModule('app-snapshot.js', {
        dependencies: { rebuildSelectedCardsMap },
        exports: ['hydrateDeckState']
    }).hydrateDeckState;
}

function loadRestoreDeckState(state, document, hooks = {}) {
    const file = path.join(__dirname, '..', 'initialization.js');
    const code = fs.readFileSync(file, 'utf8');
    const match = code.match(/function restoreDeckState\(deckState\) \{[\s\S]*?\n\}/);
    if (!match) throw new Error('restoreDeckState function not found');

    return new Function(
        'state',
        'liveDeckSession',
        'hydrateDeckState',
        'document',
        `${match[0]}; return restoreDeckState;`
    )(
        state,
        hooks.liveDeckSession || { present() { } },
        hooks.hydrateDeckState || loadHydrateDeckState(),
        document
    );
}

console.log('Testing initialization helpers...');

{
    const elements = {
        activeDeckSection: { style: {} },
        navigationButtons: { style: {} },
        deckProgress: { style: {} },
        cardActionSection: { style: {} }
    };
    const document = {
        getElementById(id) {
            return elements[id] || null;
        }
    };

    let presentCalls = 0;

    const state = {
        currentDeck: [],
        currentIndex: -1,
        discardPile: [],
        sentryDeck: [],
        initialDeckSize: 0,
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

    const restoreDeckState = loadRestoreDeckState(state, document, {
        liveDeckSession: { present: () => { presentCalls++; } }
    });

    const restoredCard = { id: 101, card: 'Restored Card' };
    restoreDeckState({
        currentDeck: [restoredCard],
        currentIndex: 0,
        discardPile: [],
        sentryDeck: [],
        initialDeckSize: 1,
        inPlayCards: [],
        mainDeck: [restoredCard],
        specialDeck: [],
        combinedDeck: [restoredCard]
    });

    assert.strictEqual(state.currentIndex, 0, 'restoreDeckState should preserve an index of 0');
    assert.strictEqual(state.cards.selected.has('stale'), false,
        'restoreDeckState should rebuild the selected card map');
    assert.strictEqual(state.cards.selected.has(101), true,
        'restoreDeckState should mark restored cards as selected');
    assert.strictEqual(elements.activeDeckSection.style.display, 'block');
    assert.strictEqual(elements.navigationButtons.style.display, 'grid');
    assert.strictEqual(elements.deckProgress.style.display, 'block');
    assert.strictEqual(elements.cardActionSection.style.display, 'block');
    assert.strictEqual(presentCalls, 1);
}

console.log('All initialization helper tests passed!');
