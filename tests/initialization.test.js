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

function createDocument(elements = {}) {
    return {
        getElementById(id) {
            return elements[id] || null;
        }
    };
}

function createState(cardMap = new Map()) {
    return {
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
        cardMap,
        cards: {
            selected: new Map([['stale', true]])
        }
    };
}

console.log('Testing initialization helpers...');

{
    const elements = {
        activeDeckSection: { style: {} },
        navigationButtons: { style: {} },
        deckProgress: { style: {} },
        cardActionSection: { style: {} }
    };
    const richActiveCard = { id: 101, card: 'Restored Card', renderMode: 'rich' };
    const richDiscardCard = { id: 102, card: 'Discarded Card', renderMode: 'rich' };
    const richSentryCard = { id: 103, card: 'Sentry Card', renderMode: 'rich' };
    const richInPlayCard = { id: 104, card: 'In Play Card', renderMode: 'rich' };
    const state = createState(new Map([
        [101, richActiveCard],
        [102, richDiscardCard],
        [103, richSentryCard],
        [104, richInPlayCard]
    ]));
    const presented = [];
    const restoreDeckState = loadRestoreDeckState(state, createDocument(elements), {
        liveDeckSession: {
            present() {
                presented.push({
                    active: state.currentDeck[state.currentIndex],
                    inPlay: state.inPlayCards[0]
                });
            }
        }
    });

    restoreDeckState({
        currentDeck: [{ id: '101', card: 'Stale Restored Card', renderMode: 'image' }],
        currentIndex: 0,
        discardPile: [{ id: 102, card: 'Stale Discarded Card', renderMode: 'image' }],
        sentryDeck: [{ id: 103, card: 'Stale Sentry Card', renderMode: 'image' }],
        initialDeckSize: 1,
        inPlayCards: [{ id: 104, card: 'Stale In Play Card', renderMode: 'image' }],
        mainDeck: [{ id: 101 }],
        specialDeck: [{ id: 103 }],
        combinedDeck: [{ id: 101 }, { id: 103 }]
    });

    assert.strictEqual(state.currentIndex, 0, 'restoreDeckState should preserve an index of 0');
    assert.strictEqual(state.currentDeck[0], richActiveCard,
        'restoreDeckState should hydrate numeric-string ids from the canonical current catalog');
    assert.strictEqual(state.discardPile[0], richDiscardCard);
    assert.strictEqual(state.sentryDeck[0], richSentryCard);
    assert.strictEqual(state.inPlayCards[0], richInPlayCard);
    assert.strictEqual(state.deck.main[0], richActiveCard);
    assert.strictEqual(state.deck.special[0], richSentryCard);
    assert.deepStrictEqual(state.deck.combined, [richActiveCard, richSentryCard],
        'restoreDeckState should preserve combined deck order while hydrating');
    assert.strictEqual(state.cards.selected.has('stale'), false);
    assert.strictEqual(state.cards.selected.has(101), true);
    assert.strictEqual(state.cards.selected.has(102), true);
    assert.strictEqual(state.cards.selected.has(103), true);
    assert.strictEqual(state.cards.selected.has(104), true);
    assert.strictEqual(elements.activeDeckSection.style.display, 'block');
    assert.strictEqual(elements.navigationButtons.style.display, 'grid');
    assert.strictEqual(elements.deckProgress.style.display, 'block');
    assert.strictEqual(elements.cardActionSection.style.display, 'block');
    assert.deepStrictEqual(presented, [{ active: richActiveCard, inPlay: richInPlayCard }],
        'The live session should receive canonical rich active and in-play cards together');
}

{
    const elements = {
        activeDeckSection: { style: {} },
        navigationButtons: { style: {} },
        deckProgress: { style: {} },
        cardActionSection: { style: {} }
    };
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = message => warnings.push(message);
    const missingSavedCard = { id: 999, card: 'Missing Card', renderMode: 'image', sourceImage: 'Missing.png' };
    const state = createState();
    const restoreDeckState = loadRestoreDeckState(state, createDocument(elements));

    try {
        restoreDeckState({
            currentDeck: [missingSavedCard],
            currentIndex: 0,
            mainDeck: [missingSavedCard],
            combinedDeck: []
        });
    } finally {
        console.warn = originalWarn;
    }

    assert.strictEqual(state.currentDeck[0], missingSavedCard,
        'Saved cards missing from the current catalog should remain usable as fallbacks');
    assert.strictEqual(state.deck.main[0], missingSavedCard);
    assert.strictEqual(state.deck.combined, state.currentDeck,
        'An empty combined snapshot should fall back to the hydrated current deck');
    assert.strictEqual(state.cards.selected.has(999), true);
    assert.strictEqual(warnings.length, 2,
        'Each missing-id collection entry should produce a diagnostic warning');
}

{
    const state = createState();
    let presentCalls = 0;
    const restoreDeckState = loadRestoreDeckState(state, createDocument(), {
        liveDeckSession: { present() { presentCalls++; } }
    });

    restoreDeckState({
        currentDeck: { malformed: true },
        currentIndex: '0',
        discardPile: 'bad',
        sentryDeck: null,
        inPlayCards: { malformed: true },
        mainDeck: 42,
        specialDeck: false,
        combinedDeck: 'bad'
    });

    assert.deepStrictEqual(state.currentDeck, []);
    assert.deepStrictEqual(state.discardPile, []);
    assert.deepStrictEqual(state.sentryDeck, []);
    assert.deepStrictEqual(state.inPlayCards, []);
    assert.deepStrictEqual(state.deck.main, []);
    assert.deepStrictEqual(state.deck.special, []);
    assert.strictEqual(state.deck.combined, state.currentDeck);
    assert.strictEqual(state.currentIndex, -1);
    assert.strictEqual(presentCalls, 0,
        'Malformed restored collections should normalize safely without presenting an active deck');
}

console.log('All initialization helper tests passed!');
