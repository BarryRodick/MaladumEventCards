/**
 * Test suite for live deck transitions
 * Run with: node tests/liveDeck.test.js
 */
const assert = require('assert');
const { loadSourceModule } = require('./helpers/load-source-module');

function loadLiveDeck(overrides = {}) {
    return loadSourceModule('live-deck.js', {
        dependencies: {
            parseCardTypes: overrides.parseCardTypes || ((typeString = '') => {
                const andGroups = typeString.split('+').map(group =>
                    group.trim().split('/').map(option => option.trim())
                );
                return { andGroups, allTypes: [...new Set(andGroups.flat())] };
            }),
            shuffleDeck: overrides.shuffleDeck || ((deck) => deck)
        },
        exports: [
            'advanceLiveDeck',
            'goToPreviousCard',
            'clearActiveCard',
            'liveDeckActions',
            'shuffleCardIntoTopN',
            'insertSpecificCardById',
            'rebuildSelectedCardsMap'
        ]
    });
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
        availableCards: [
            { id: 1, card: 'A' },
            { id: 2, card: 'B' },
            { id: 3, card: 'C' },
            { id: 4, card: 'D' }
        ],
        cards: { selected: new Map([[1, true], [2, true]]) }
    };

    const nextResult = insertSpecificCardById(state, 3, 'next');
    const bottomResult = insertSpecificCardById(state, 4, 'bottom');

    assert.strictEqual(nextResult.ok, true);
    assert.strictEqual(bottomResult.ok, true);
    assert.deepStrictEqual(state.currentDeck.map(card => card.id), [1, 3, 2, 4]);
    assert.strictEqual(state.cards.selected.has(3), true);
    assert.strictEqual(state.cards.selected.has(4), true);
}

{
    const { liveDeckActions } = loadLiveDeck();
    const state = {
        currentDeck: [
            { id: 1, card: 'A' },
            { id: 2, card: 'B' },
            { id: 3, card: 'C' },
            { id: 4, card: 'D' },
            { id: 5, card: 'E' }
        ],
        currentIndex: 1,
        cards: { selected: new Map() }
    };
    const activeCard = state.currentDeck[state.currentIndex];
    const originalRandom = Math.random;

    try {
        Math.random = () => 0.999;
        const result = liveDeckActions.shuffleTopN(state, activeCard, 2);
        const newIndex = state.currentDeck.findIndex(card => card.id === activeCard.id);

        assert.strictEqual(result.message.includes('next 2 cards'), true);
        assert.strictEqual(result.render, true);
        assert(newIndex >= state.currentIndex && newIndex <= state.currentIndex + 1,
            'shuffleTopN should insert within the next N cards');
    } finally {
        Math.random = originalRandom;
    }
}

{
    const { liveDeckActions } = loadLiveDeck();
    const state = {
        currentDeck: [{ id: 1, card: 'A' }],
        currentIndex: 0,
        cards: { selected: new Map() }
    };

    const result = liveDeckActions.shuffleTopN(state, state.currentDeck[0], 3);

    assert.strictEqual(result.message, 'No remaining cards to shuffle into.');
    assert.strictEqual(state.currentDeck.length, 1);
}

{
    const { liveDeckActions } = loadLiveDeck();
    const state = {
        currentDeck: [
            { id: 1, card: 'A' },
            { id: 2, card: 'B' },
            { id: 3, card: 'C' }
        ],
        currentIndex: 0,
        cards: { selected: new Map() }
    };
    const originalRandom = Math.random;

    try {
        Math.random = () => 0;
        const result = liveDeckActions.shuffleAnywhere(state, state.currentDeck[0]);

        assert.strictEqual(result.render, true);
        assert.strictEqual(result.direction, 'backward');
        assert.strictEqual(state.currentIndex, -1,
            'shuffleAnywhere should reveal the card back at index 0');
    } finally {
        Math.random = originalRandom;
    }
}

{
    const { liveDeckActions } = loadLiveDeck();
    const state = {
        currentDeck: [{ id: 1, card: 'A' }],
        currentIndex: 0,
        deckDataByType: {
            Denizen: [
                { id: 1, card: 'A' },
                { id: 2, card: 'B' }
            ]
        },
        cards: { selected: new Map([[1, true]]) }
    };

    const duplicateResult = liveDeckActions.insertCardType(state, state.currentDeck[0], {
        cardType: 'Denizen',
        specificCardId: 1,
        position: 'bottom'
    });
    assert.strictEqual(duplicateResult.message, 'Card "A" is already in the deck.');
    assert.strictEqual(state.currentDeck.length, 1);

    const insertResult = liveDeckActions.insertCardType(state, state.currentDeck[0], {
        cardType: 'Denizen',
        specificCardId: 2,
        position: 'bottom'
    });
    assert.strictEqual(insertResult.message.includes('Inserted "B"'), true);
    assert.strictEqual(insertResult.progress, true);
    assert.strictEqual(state.currentDeck.length, 2);
    assert.strictEqual(state.cards.selected.has(2), true);
}

{
    const { shuffleCardIntoTopN } = loadLiveDeck();
    const state = {
        currentDeck: [
            { id: 1, card: 'A' },
            { id: 2, card: 'B' }
        ],
        currentIndex: 1,
        availableCards: [
            { id: 1, card: 'A' },
            { id: 2, card: 'B' }
        ],
        cards: { selected: new Map([[1, true], [2, true]]) }
    };

    const result = shuffleCardIntoTopN(state, 1, 3);

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.message, 'No remaining cards to shuffle into.');
    assert.deepStrictEqual(state.currentDeck.map(card => card.id), [1, 2]);
    assert.strictEqual(state.currentIndex, 1);
}

console.log('All live deck transition tests passed!');
