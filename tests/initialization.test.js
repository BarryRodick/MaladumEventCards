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
        showCurrentCard: () => { showCurrentCardCalls++; },
        updateProgressBar: () => { updateProgressBarCalls++; },
        updateInPlayCardsDisplay: () => { updateInPlayCardsDisplayCalls++; }
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
    assert.strictEqual(elements.navigationButtons.style.display, 'flex');
    assert.strictEqual(elements.deckProgress.style.display, 'block');
    assert.strictEqual(elements.cardActionSection.style.display, 'block');
    assert.strictEqual(showCurrentCardCalls, 1);
    assert.strictEqual(updateProgressBarCalls, 1);
    assert.strictEqual(updateInPlayCardsDisplayCalls, 1);
}

console.log('All initialization helper tests passed!');
