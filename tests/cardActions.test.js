/**
 * Test suite for card actions
 * Run with: node tests/cardActions.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadCardActions(state) {
    const file = path.join(__dirname, '..', 'card-actions.js');
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/import .*?\r?\n/g, '');
    code = code.replace(/export const cardActions\s*=\s*/, 'const cardActions = ');
    code = code.replace(/export function /g, 'function ');

    const parseCardTypes = () => ({ andGroups: [], allTypes: [] });
    const shuffleDeck = (deck) => deck;
    const showToast = () => { };
    const trackEvent = () => { };
    const saveConfiguration = () => { };
    const showCurrentCard = () => { };
    const updateProgressBar = () => { };

    const factory = new Function(
        'state',
        'parseCardTypes',
        'shuffleDeck',
        'showToast',
        'trackEvent',
        'saveConfiguration',
        'showCurrentCard',
        'updateProgressBar',
        `${code}; return { cardActions };`
    );

    return factory(
        state,
        parseCardTypes,
        shuffleDeck,
        showToast,
        trackEvent,
        saveConfiguration,
        showCurrentCard,
        updateProgressBar
    );
}

console.log('Testing card actions...');

// ============================
// Test: shuffleTopN bounds
// ============================
{
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
    const { cardActions } = loadCardActions(state);

    const originalRandom = Math.random;
    Math.random = () => 0.999;

    const active = state.currentDeck[state.currentIndex];
    const result = cardActions.shuffleTopN(active, 2);
    const newIndex = state.currentDeck.findIndex(c => c.id === active.id);

    Math.random = originalRandom;

    assert.strictEqual(result.includes('next 2 cards'), true, 'shuffleTopN should report the correct N');
    assert(newIndex >= state.currentIndex && newIndex <= state.currentIndex + 1,
        'shuffleTopN should insert within the next N cards');
}

// ============================
// Test: shuffleTopN no remaining
// ============================
{
    const state = {
        currentDeck: [{ id: 1, card: 'A' }],
        currentIndex: 0,
        cards: { selected: new Map() }
    };
    const { cardActions } = loadCardActions(state);
    const result = cardActions.shuffleTopN(state.currentDeck[0], 3);
    assert.strictEqual(result, 'No remaining cards to shuffle into.');
    assert.strictEqual(state.currentDeck.length, 1);
}

// ============================
// Test: shuffleAnywhere at start
// ============================
{
    const state = {
        currentDeck: [
            { id: 1, card: 'A' },
            { id: 2, card: 'B' },
            { id: 3, card: 'C' }
        ],
        currentIndex: 0,
        cards: { selected: new Map() }
    };
    const { cardActions } = loadCardActions(state);
    const originalRandom = Math.random;
    Math.random = () => 0;
    cardActions.shuffleAnywhere(state.currentDeck[0]);
    Math.random = originalRandom;
    assert.strictEqual(state.currentIndex, -1, 'shuffleAnywhere should reveal card back at index 0');
}

// ============================
// Test: insertCardType uniqueness
// ============================
{
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
    const { cardActions } = loadCardActions(state);

    const duplicateResult = cardActions.insertCardType(state.currentDeck[0], {
        cardType: 'Denizen',
        specificCardId: 1,
        position: 'bottom'
    });
    assert.strictEqual(duplicateResult, 'Card "A" is already in the deck.');
    assert.strictEqual(state.currentDeck.length, 1);

    const insertResult = cardActions.insertCardType(state.currentDeck[0], {
        cardType: 'Denizen',
        specificCardId: 2,
        position: 'bottom'
    });
    assert.strictEqual(insertResult.includes('Inserted "B"'), true);
    assert.strictEqual(state.currentDeck.length, 2);
    assert.strictEqual(state.cards.selected.has(2), true);
}

console.log('All card action tests passed!');
