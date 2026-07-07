/**
 * Test suite for live deck transitions
 * Run with: node tests/liveDeck.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadLiveDeck(overrides = {}) {
    const file = path.join(__dirname, '..', 'live-deck.js');
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/import .*?\r?\n/g, '');
    code = code.replace(/export const /g, 'const ');
    code = code.replace(/export function /g, 'function ');

    const factory = new Function(
        'parseCardTypes',
        'shuffleDeck',
        `${code}; return { advanceLiveDeck, goToPreviousCard, clearActiveCard, liveDeckActions, shuffleCardIntoTopN, insertSpecificCardById, rebuildSelectedCardsMap };`
    );

    return factory(
        overrides.parseCardTypes || ((typeString = '') => {
            const andGroups = typeString.split('+').map(group =>
                group.trim().split('/').map(option => option.trim())
            );
            return { andGroups, allTypes: [...new Set(andGroups.flat())] };
        }),
        overrides.shuffleDeck || ((deck) => deck)
    );
}

console.log('Testing live deck transitions...');

{
    const { advanceLiveDeck } = loadLiveDeck();
    const state = {
        currentDeck: [{ id: 1, card: 'A' }, { id: 2, card: 'B' }],
        currentIndex: -1,
        discardPile: [],
        isActiveCardCleared: false
    };

    let result = advanceLiveDeck(state);
    assert.strictEqual(result.render, true);
    assert.strictEqual(state.currentIndex, 0);
    assert.deepStrictEqual(state.discardPile, []);

    result = advanceLiveDeck(state);
    assert.strictEqual(result.render, true);
    assert.strictEqual(state.currentIndex, 1);
    assert.deepStrictEqual(state.discardPile.map(card => card.id), [1]);
}

{
    const { clearActiveCard, advanceLiveDeck } = loadLiveDeck();
    const state = {
        currentDeck: [{ id: 1, card: 'A' }, { id: 2, card: 'B' }],
        currentIndex: 1,
        discardPile: [{ id: 1, card: 'A' }],
        isActiveCardCleared: false
    };

    assert.strictEqual(clearActiveCard(state), true);
    const result = advanceLiveDeck(state);
    assert.strictEqual(result.render, true);
    assert.strictEqual(state.currentIndex, 1);
    assert.deepStrictEqual(state.discardPile.map(card => card.id), [1]);
}

{
    const { shuffleCardIntoTopN } = loadLiveDeck();
    const state = {
        currentDeck: [{ id: 1, card: 'A' }, { id: 2, card: 'B' }],
        currentIndex: 0,
        discardPile: [{ id: 3, card: 'C' }],
        availableCards: [{ id: 1, card: 'A' }, { id: 2, card: 'B' }, { id: 3, card: 'C' }],
        cards: { selected: new Map([[1, true], [2, true], [3, true]]) }
    };

    const result = shuffleCardIntoTopN(state, 3, 1);
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(state.currentDeck.map(card => card.id), [1, 3, 2]);
    assert.deepStrictEqual(state.discardPile, []);
}

{
    const { insertSpecificCardById } = loadLiveDeck();
    const state = {
        currentDeck: [{ id: 1, card: 'A' }, { id: 2, card: 'B' }],
        currentIndex: 0,
        availableCards: [{ id: 1, card: 'A' }, { id: 2, card: 'B' }, { id: 3, card: 'C' }],
        cards: { selected: new Map([[1, true], [2, true]]) }
    };

    const result = insertSpecificCardById(state, 3, 'next');
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(state.currentDeck.map(card => card.id), [1, 3, 2]);
    assert.strictEqual(state.cards.selected.has(3), true);
}

console.log('All live deck transition tests passed!');
