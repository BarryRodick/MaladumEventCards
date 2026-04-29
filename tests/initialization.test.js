/**
 * Test suite for initialization helpers
 * Run with: node tests/initialization.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadRestoreDeckState(state, document, hooks = {}) {
    const file = path.join(__dirname, '..', 'initialization.js');
    const code = fs.readFileSync(file, 'utf8');
    const match = code.match(/function restoreDeckState\(deckState\) \{[\s\S]*?\n\}/);
    if (!match) throw new Error('restoreDeckState function not found');

    return new Function(
        'state',
        'showCurrentCard',
        'updateProgressBar',
        'updateInPlayCardsDisplay',
        'document',
        `${match[0]}; return restoreDeckState;`
    )(
        state,
        hooks.showCurrentCard || (() => { }),
        hooks.updateProgressBar || (() => { }),
        hooks.updateInPlayCardsDisplay || (() => { }),
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

    let showCurrentCardCalls = 0;
    let updateProgressBarCalls = 0;
    let updateInPlayCardsDisplayCalls = 0;
    let showCurrentCardRenderMode = null;

    const richActiveCard = { id: 101, card: 'Restored Card', renderMode: 'rich' };
    const richDiscardCard = { id: 102, card: 'Discarded Card', renderMode: 'rich' };
    const richSentryCard = { id: 103, card: 'Sentry Card', renderMode: 'rich' };
    const richInPlayCard = { id: 104, card: 'In Play Card', renderMode: 'rich' };

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
        cardMap: new Map([
            [101, richActiveCard],
            [102, richDiscardCard],
            [103, richSentryCard],
            [104, richInPlayCard]
        ]),
        cards: {
            selected: new Map([['stale', true]])
        }
    };

    const restoreDeckState = loadRestoreDeckState(state, document, {
        showCurrentCard: () => {
            showCurrentCardCalls++;
            showCurrentCardRenderMode = state.currentDeck[0]?.renderMode || null;
        },
        updateProgressBar: () => { updateProgressBarCalls++; },
        updateInPlayCardsDisplay: () => { updateInPlayCardsDisplayCalls++; }
    });

    restoreDeckState({
        currentDeck: [{ id: 101, card: 'Restored Card', renderMode: 'image', sourceImage: 'Restored_Card.png' }],
        currentIndex: 0,
        discardPile: [{ id: 102, card: 'Discarded Card', renderMode: 'image', sourceImage: 'Discarded_Card.png' }],
        sentryDeck: [{ id: 103, card: 'Sentry Card', renderMode: 'image', sourceImage: 'Sentry_Card.png' }],
        initialDeckSize: 1,
        inPlayCards: [{ id: 104, card: 'In Play Card', renderMode: 'image', sourceImage: 'In_Play_Card.png' }],
        mainDeck: [{ id: 101, card: 'Restored Card', renderMode: 'image', sourceImage: 'Restored_Card.png' }],
        specialDeck: [{ id: 103, card: 'Sentry Card', renderMode: 'image', sourceImage: 'Sentry_Card.png' }],
        combinedDeck: [
            { id: 101, card: 'Restored Card', renderMode: 'image', sourceImage: 'Restored_Card.png' },
            { id: 103, card: 'Sentry Card', renderMode: 'image', sourceImage: 'Sentry_Card.png' }
        ]
    });

    assert.strictEqual(state.currentIndex, 0, 'restoreDeckState should preserve an index of 0');
    assert.strictEqual(state.currentDeck[0], richActiveCard,
        'restoreDeckState should rehydrate the active deck card from the canonical card map');
    assert.strictEqual(state.discardPile[0], richDiscardCard,
        'restoreDeckState should rehydrate discard pile cards from the canonical card map');
    assert.strictEqual(state.sentryDeck[0], richSentryCard,
        'restoreDeckState should rehydrate sentry deck cards from the canonical card map');
    assert.strictEqual(state.inPlayCards[0], richInPlayCard,
        'restoreDeckState should rehydrate in-play cards from the canonical card map');
    assert.strictEqual(state.deck.main[0], richActiveCard,
        'restoreDeckState should rehydrate main deck cards from the canonical card map');
    assert.strictEqual(state.deck.special[0], richSentryCard,
        'restoreDeckState should rehydrate special deck cards from the canonical card map');
    assert.strictEqual(state.deck.combined[0], richActiveCard,
        'restoreDeckState should rehydrate combined deck cards from the canonical card map');
    assert.strictEqual(state.deck.combined[1], richSentryCard,
        'restoreDeckState should preserve combined deck order while rehydrating');
    assert.strictEqual(state.cards.selected.has('stale'), false,
        'restoreDeckState should rebuild the selected card map');
    assert.strictEqual(state.cards.selected.has(101), true,
        'restoreDeckState should mark restored cards as selected');
    assert.strictEqual(state.cards.selected.has(102), true,
        'restoreDeckState should mark discard pile cards as selected');
    assert.strictEqual(state.cards.selected.has(103), true,
        'restoreDeckState should mark sentry cards as selected');
    assert.strictEqual(state.cards.selected.has(104), true,
        'restoreDeckState should mark in-play cards as selected');
    assert.strictEqual(elements.activeDeckSection.style.display, 'block');
    assert.strictEqual(elements.navigationButtons.style.display, 'flex');
    assert.strictEqual(elements.deckProgress.style.display, 'block');
    assert.strictEqual(elements.cardActionSection.style.display, 'block');
    assert.strictEqual(showCurrentCardCalls, 1);
    assert.strictEqual(showCurrentCardRenderMode, 'rich',
        'restoreDeckState should hand showCurrentCard the canonical rich card after rehydration');
    assert.strictEqual(updateProgressBarCalls, 1);
    assert.strictEqual(updateInPlayCardsDisplayCalls, 1);
}

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

    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (message) => warnings.push(message);

    const missingSavedCard = { id: 999, card: 'Missing Card', renderMode: 'image', sourceImage: 'Missing.png' };
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
        cardMap: new Map(),
        cards: {
            selected: new Map()
        }
    };

    const restoreDeckState = loadRestoreDeckState(state, document, {
        showCurrentCard: () => { },
        updateProgressBar: () => { },
        updateInPlayCardsDisplay: () => { }
    });

    try {
        restoreDeckState({
            currentDeck: [missingSavedCard],
            currentIndex: 0,
            discardPile: [],
            sentryDeck: [],
            initialDeckSize: 1,
            inPlayCards: [],
            mainDeck: [missingSavedCard],
            specialDeck: [],
            combinedDeck: []
        });
    } finally {
        console.warn = originalWarn;
    }

    assert.strictEqual(state.currentDeck[0], missingSavedCard,
        'restoreDeckState should preserve saved cards when their ids are missing from the current catalog');
    assert.strictEqual(state.deck.main[0], missingSavedCard,
        'restoreDeckState should preserve missing-id main deck cards as a fallback');
    assert.strictEqual(state.deck.combined, state.currentDeck,
        'restoreDeckState should fall back to the rehydrated current deck when no combined deck is saved');
    assert.strictEqual(state.cards.selected.has(999), true,
        'restoreDeckState should keep missing-id fallback cards in the selected map');
    assert.strictEqual(warnings.length, 2,
        'restoreDeckState should log a warning for each missing-id fallback it preserves');
}

console.log('All initialization helper tests passed!');
