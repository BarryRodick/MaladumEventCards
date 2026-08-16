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
        exports: ['buildDeck', 'DECK_RULE_ERRORS', 'validateDeckCount']
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

    [0, 1, 5].forEach(configuredCount => {
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
            specialCardCounts: { Corrupter: configuredCount },
            corrupterReplacementCount: 5
        });

        const corrupterIds = result.combinedDeck
            .filter(card => card.type === 'Corrupter')
            .map(card => card.id);

        assert.strictEqual(result.combinedDeck.length, 5);
        assert.strictEqual(corrupterIds.length, 5,
            `Corrupter rules should replace five cards when the configured count is ${configuredCount}`);
        assert.strictEqual(new Set(corrupterIds).size, 5);
    });

    const shortDeck = buildDeck({
        allCardTypes: ['Denizen', 'Corrupter'],
        availableCards: cards,
        deckDataByType: {
            Denizen: cards.slice(0, 4),
            Corrupter: cards.slice(5)
        },
        dataStore: {
            sentryTypes: [],
            corrupterTypes: ['Corrupter'],
            heldBackCardTypes: []
        },
        enableCorrupterRules: true,
        cardCounts: { Denizen: 4 },
        specialCardCounts: { Corrupter: 5 },
        corrupterReplacementCount: 5
    });

    assert.strictEqual(shortDeck.combinedDeck.length, 4,
        'Corrupter cards should not be appended when the main deck is too short for replacement');
    assert.strictEqual(shortDeck.combinedDeck.some(card => card.type === 'Corrupter'), false);
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

{
    const { buildDeck, DECK_RULE_ERRORS, validateDeckCount } = loadDeckRules();
    const cards = [
        { id: 1, card: 'Cabal A', type: 'Cabal' },
        { id: 2, card: 'Cabal B', type: 'Cabal' }
    ];

    ['99', '', '1.5', '-1', '1e2'].forEach(value => {
        const result = buildDeck({
            allCardTypes: ['Cabal'],
            availableCards: cards,
            dataStore: { sentryTypes: [], corrupterTypes: [], heldBackCardTypes: [] },
            cardCounts: { Cabal: value }
        });
        assert.strictEqual(result.error, DECK_RULE_ERRORS.invalidCounts,
            `Invalid count ${JSON.stringify(value)} must be rejected instead of truncated or clamped`);
    });

    assert.deepStrictEqual(validateDeckCount('0', 2), { valid: true, value: 0 });
    assert.deepStrictEqual(validateDeckCount('2', 2), { valid: true, value: 2 });
    assert.deepStrictEqual(validateDeckCount('3', 2), {
        valid: false,
        requested: 3,
        available: 2,
        message: 'Requested 3; 2 available. Enter a whole number from 0 to 2.'
    });
}

{
    const { buildDeck, DECK_RULE_ERRORS } = loadDeckRules();
    const cards = [
        { id: 1, card: 'Denizen A', type: 'Denizen' },
        { id: 98, card: 'Corrupter A', type: 'Corrupter' },
        { id: 99, card: 'Corrupter B', type: 'Corrupter' }
    ];

    ['', '1.5', '1e2', '-1', '3'].forEach(value => {
        const result = buildDeck({
            allCardTypes: ['Denizen', 'Corrupter'],
            availableCards: cards,
            dataStore: {
                sentryTypes: [],
                corrupterTypes: ['Corrupter'],
                heldBackCardTypes: []
            },
            cardCounts: { Denizen: 1 },
            specialCardCounts: { Corrupter: value },
            enableCorrupterRules: true,
            corrupterReplacementCount: 5,
            deckDataByType: { Corrupter: cards.slice(1) }
        });

        assert.strictEqual(result.error, DECK_RULE_ERRORS.invalidCounts,
            `Invalid Corrupter count ${JSON.stringify(value)} must be rejected by deck rules`);
        assert(result.invalidCounts.some(({ type }) => type === 'Corrupter'));
    });
}

{
    const { buildDeck, DECK_RULE_ERRORS } = loadDeckRules();
    const result = buildDeck({
        allCardTypes: ['Denizen', 'Dungeon'],
        availableCards: [
            { id: 1, card: 'Either Type', type: 'Denizen / Dungeon' }
        ],
        dataStore: { sentryTypes: [], corrupterTypes: [], heldBackCardTypes: [] },
        cardCounts: { Denizen: 1, Dungeon: 1 }
    });

    assert.strictEqual(result.error, DECK_RULE_ERRORS.invalidCounts,
        'One alternative-type card cannot fulfil two requested type counts');
    assert.deepStrictEqual(result.invalidCounts.map(({ type, requested, available }) => ({
        type,
        requested,
        available
    })), [
        { type: 'Dungeon', requested: 1, available: 0 }
    ]);
    assert(result.invalidCounts[0].message.includes('Requested 1'));
    assert(result.invalidCounts[0].message.includes('0 available'));
}

{
    const { buildDeck } = loadDeckRules();
    const result = buildDeck({
        allCardTypes: ['Denizen', 'Dungeon'],
        availableCards: [
            { id: 1, card: 'Compound Type', type: 'Denizen + Dungeon' }
        ],
        dataStore: { sentryTypes: [], corrupterTypes: [], heldBackCardTypes: [] },
        cardCounts: { Denizen: 1, Dungeon: 1 }
    });

    assert.strictEqual(result.error, undefined,
        'One compound card should fulfil one requested count in each required group');
    assert.deepStrictEqual(result.combinedDeck.map(card => card.id), [1]);
}

{
    const { buildDeck } = loadDeckRules();
    const result = buildDeck({
        allCardTypes: ['Environment', 'Revenant', 'Veteran'],
        availableCards: [
            { id: 1, card: 'Fresh Graves', type: 'Revenant + Veteran' },
            { id: 2, card: 'Environment A', type: 'Environment' }
        ],
        dataStore: {
            sentryTypes: ['Revenant'],
            corrupterTypes: [],
            heldBackCardTypes: ['Veteran']
        },
        cardCounts: { Environment: 1, Veteran: 1 },
        sentryCardCounts: { Revenant: 1 },
        enableSentryRules: true
    });

    assert.strictEqual(result.error, undefined,
        'A Sentry/regular compound card should jointly fulfil both requested counts');
    assert.deepStrictEqual(result.mainDeck.map(card => card.id), [2]);
    assert.deepStrictEqual(result.sentryDeck.map(card => card.id), [1],
        'A compound allocation that fulfils a Sentry count should remain set aside as Sentry');
    assert.deepStrictEqual(result.selectedCardIds.sort((left, right) => left - right), [1, 2]);
}

{
    const { buildDeck } = loadDeckRules();
    const compoundCard = { id: 1, card: 'Either Type', type: 'A / B' };
    const dedicatedCard = { id: 2, card: 'A Only', type: 'A' };
    const adverseOrders = [
        {
            cards: [compoundCard, dedicatedCard],
            shuffle: cards => cards
        },
        {
            cards: [dedicatedCard, compoundCard],
            shuffle: cards => [...cards].reverse()
        }
    ];

    adverseOrders.forEach(({ cards, shuffle }, index) => {
        const result = buildDeck({
            allCardTypes: ['A', 'B'],
            availableCards: cards,
            dataStore: { sentryTypes: [], corrupterTypes: [], heldBackCardTypes: [] },
            cardCounts: { A: 1, B: 1 },
            shuffle
        });

        assert.strictEqual(result.error, undefined,
            `A fulfillable alternative-type request must survive adverse shuffle order ${index + 1}`);
        assert.deepStrictEqual(
            result.combinedDeck.map(card => card.id).sort((left, right) => left - right),
            [1, 2],
            'The A-only card must satisfy A so the A/B card remains available for B'
        );
    });

    const multipleSolutions = [
        compoundCard,
        dedicatedCard,
        { id: 3, card: 'B Only', type: 'B' },
        { id: 4, card: 'Second A', type: 'A' },
        { id: 5, card: 'Second B', type: 'B' }
    ];
    const selectedSets = [
        { cards: multipleSolutions, shuffle: cards => cards },
        { cards: [...multipleSolutions].reverse(), shuffle: cards => [...cards].reverse() }
    ].map(({ cards, shuffle }) => buildDeck({
        allCardTypes: ['A', 'B'],
        availableCards: cards,
        dataStore: { sentryTypes: [], corrupterTypes: [], heldBackCardTypes: [] },
        cardCounts: { A: 1, B: 1 },
        shuffle
    }).combinedDeck.map(card => card.id).sort((left, right) => left - right));

    assert.deepStrictEqual(selectedSets, [[2, 3], [2, 3]],
        'Allocation should choose the same valid cards before final deck shuffling');
}

{
    const { buildDeck, DECK_RULE_ERRORS } = loadDeckRules();
    const result = buildDeck({
        allCardTypes: ['Corrupter'],
        availableCards: [{ id: 98, card: 'Corrupter A', type: 'Corrupter' }],
        deckDataByType: {
            Corrupter: [{ id: 98, card: 'Corrupter A', type: 'Corrupter' }]
        },
        dataStore: {
            sentryTypes: [],
            corrupterTypes: ['Corrupter'],
            heldBackCardTypes: []
        },
        enableCorrupterRules: true,
        specialCardCounts: { Corrupter: 1 },
        corrupterReplacementCount: 5
    });

    assert.strictEqual(result.error, DECK_RULE_ERRORS.emptySelection,
        'Corrupter rules require a regular or Sentry selection to build a deck');
}

console.log('All deck rules tests passed!');
