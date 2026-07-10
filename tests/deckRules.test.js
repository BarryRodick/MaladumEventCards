/**
 * Test suite for deck rules
 * Run with: node tests/deckRules.test.js
 */
const assert = require('assert');
const { loadSourceModule } = require('./helpers/load-source-module');

function loadDeckRules(overrides = {}) {
    return loadSourceModule('deck-rules.js', {
        dependencies: {
            parseCardTypes: overrides.parseCardTypes || ((typeString) => {
                const andGroups = typeString.split('+').map(group =>
                    group.trim().split('/').map(option => option.trim())
                );
                return { andGroups, allTypes: [...new Set(andGroups.flat())] };
            }),
            shuffleDeck: overrides.shuffleDeck || ((deck) => deck)
        },
        exports: ['buildDeck', 'DECK_RULE_ERRORS']
    });
}

console.log('Testing deck rules...');

{
    const { buildDeck } = loadDeckRules();
    const cards = [
        { id: 1, card: 'Denizen A', type: 'Denizen', contents: 'a.png' },
        { id: 2, card: 'Novice A', type: 'Novice', contents: 'b.png' },
        { id: 3, card: 'Veteran A', type: 'Veteran', contents: 'c.png' }
    ];

    const result = buildDeck({
        allCardTypes: ['Denizen', 'Novice', 'Veteran'],
        availableCards: cards,
        dataStore: {
            sentryTypes: [],
            corrupterTypes: [],
            heldBackCardTypes: ['Novice', 'Veteran']
        },
        cardCounts: { Denizen: 1, Novice: 1, Veteran: 1 }
    });

    assert.deepStrictEqual(result.combinedDeck.map(card => card.id), [1, 2, 3]);
    assert.deepStrictEqual(result.setAsideCards.map(card => card.id), [2, 3]);
    assert.deepStrictEqual(result.selectedCardIds, [1, 2, 3]);
}

{
    const { buildDeck } = loadDeckRules();
    const cards = [
        { id: 1, card: 'Denizen A', type: 'Denizen', contents: 'a.png' },
        { id: 2, card: 'Denizen B', type: 'Denizen', contents: 'b.png' },
        { id: 3, card: 'Denizen C', type: 'Denizen', contents: 'c.png' },
        { id: 4, card: 'Denizen D', type: 'Denizen', contents: 'd.png' },
        { id: 5, card: 'Denizen E', type: 'Denizen', contents: 'e.png' },
        { id: 98, card: 'Corrupter A', type: 'Corrupter', contents: 'ca.png' },
        { id: 99, card: 'Corrupter B', type: 'Corrupter', contents: 'cb.png' },
        { id: 100, card: 'Corrupter C', type: 'Corrupter', contents: 'cc.png' },
        { id: 101, card: 'Corrupter D', type: 'Corrupter', contents: 'cd.png' },
        { id: 102, card: 'Corrupter E', type: 'Corrupter', contents: 'ce.png' }
    ];

    const result = buildDeck({
        allCardTypes: ['Denizen', 'Corrupter'],
        availableCards: cards,
        deckDataByType: {
            Denizen: cards.slice(0, 5),
            Corrupter: cards.slice(5)
        },
        dataStore: {
            sentryTypes: [],
            corrupterTypes: ['Corrupter'],
            heldBackCardTypes: []
        },
        enableCorrupterRules: true,
        cardCounts: { Denizen: 5 },
        specialCardCounts: { Corrupter: 5 },
        corrupterReplacementCount: 5
    });

    const corrupterIds = result.combinedDeck
        .filter(card => card.type === 'Corrupter')
        .map(card => card.id);

    assert.strictEqual(result.combinedDeck.length, 5);
    assert.strictEqual(corrupterIds.length, 5);
    assert.strictEqual(new Set(corrupterIds).size, 5);
}

{
    const { buildDeck, DECK_RULE_ERRORS } = loadDeckRules();
    const result = buildDeck({
        allCardTypes: ['Denizen'],
        availableCards: [{ id: 1, card: 'Denizen A', type: 'Denizen' }],
        dataStore: {
            sentryTypes: [],
            corrupterTypes: [],
            heldBackCardTypes: []
        },
        cardCounts: { Denizen: 0 }
    });

    assert.strictEqual(result.error, DECK_RULE_ERRORS.emptySelection);
}

console.log('All deck rules tests passed!');
