/**
 * Test suite for card actions
 * Run with: node tests/cardActions.test.js
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
        `${code}; return { insertSpecificCardById, liveDeckActions, markCardInPlay, removeCardFromPlay, shuffleCardIntoTopN };`
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

function loadCardActions(state, overrides = {}) {
    const file = path.join(__dirname, '..', 'card-actions.js');
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/import[\s\S]*?from ['"].*?['"];\r?\n/g, '');
    code = code.replace(/export const cardActions\s*=\s*/, 'const cardActions = ');
    code = code.replace(/export function /g, 'function ');

    const liveDeck = loadLiveDeck(overrides);
    const showToast = overrides.showToast || (() => { });
    const trackEvent = overrides.trackEvent || (() => { });
    const saveConfiguration = overrides.saveConfiguration || (() => { });
    const showCurrentCard = overrides.showCurrentCard || (() => { });
    const updateProgressBar = overrides.updateProgressBar || (() => { });

    const factory = new Function(
        'state',
        'showToast',
        'trackEvent',
        'saveConfiguration',
        'showCurrentCard',
        'updateProgressBar',
        'insertSpecificCardIntoLiveDeck',
        'liveDeckActions',
        'markCardInPlay',
        'removeLiveCardFromPlay',
        'shuffleLiveCardIntoTopN',
        `${code}; return { cardActions, updateInPlayCardsDisplay, shuffleCardIntoTopN, insertSpecificCardById };`
    );

    return factory(
        state,
        showToast,
        trackEvent,
        saveConfiguration,
        showCurrentCard,
        updateProgressBar,
        liveDeck.insertSpecificCardById,
        liveDeck.liveDeckActions,
        liveDeck.markCardInPlay,
        liveDeck.removeCardFromPlay,
        liveDeck.shuffleCardIntoTopN
    );
}

console.log('Testing card actions...');

// ============================
// Test: in-play cards render readable controls and preview triggers
// ============================
{
    const previousDocument = global.document;
    const escape = (value) => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    function createElement() {
        return {
            children: [],
            classList: {
                values: [],
                add(...classes) {
                    this.values.push(...classes);
                }
            },
            innerHTML: '',
            appendChild(child) {
                this.children.push(child);
            },
            set textContent(value) {
                this.innerHTML = escape(value);
            }
        };
    }

    const inPlayContainer = {
        innerHTML: '',
        children: [],
        appendChild(child) {
            this.children.push(child);
        },
        querySelectorAll() {
            return [];
        }
    };
    const inPlaySection = { style: { display: 'none' } };
    const clearInPlayButton = { hidden: false, disabled: false };

    global.document = {
        createElement,
        getElementById(id) {
            if (id === 'inPlayCards') return inPlayContainer;
            if (id === 'inPlaySection') return inPlaySection;
            if (id === 'clearInPlayCards') return clearInPlayButton;
            return null;
        }
    };

    try {
        const state = {
            inPlayCards: [
                { id: 17, card: 'Wanderer', type: 'Denizen', contents: 'wanderer.jpg' }
            ]
        };
        const { updateInPlayCardsDisplay } = loadCardActions(state);

        updateInPlayCardsDisplay();

        const cardHtml = inPlayContainer.children[0].children[0].innerHTML;
        assert.strictEqual(inPlaySection.style.display, 'block');
        assert(cardHtml.includes('class="in-play-card-preview"'),
            'In-play card image should be wrapped in a preview trigger');
        assert(cardHtml.includes('data-card-image="wanderer.png"'),
            'Preview trigger should provide the readable card image');
        assert(cardHtml.includes('class="btn btn-danger remove-from-play"'),
            'Remove from Play button should use the styled readable control');
        assert.strictEqual(clearInPlayButton.hidden, false,
            'Clear All should be visible when cards are in play');
        assert.strictEqual(clearInPlayButton.disabled, false,
            'Clear All should be enabled when cards are in play');
    } finally {
        global.document = previousDocument;
    }
}

// ============================
// Test: in-play section remains visible for an empty active deck state
// ============================
{
    const previousDocument = global.document;
    const inPlayContainer = {
        innerHTML: '',
        children: [],
        appendChild(child) {
            this.children.push(child);
        },
        querySelectorAll() {
            return [];
        }
    };
    const inPlaySection = { style: { display: 'none' } };
    const clearInPlayButton = { hidden: false, disabled: false };

    global.document = {
        createElement() {
            return {
                classList: { add() { } },
                innerHTML: '',
                appendChild() { }
            };
        },
        getElementById(id) {
            if (id === 'inPlayCards') return inPlayContainer;
            if (id === 'inPlaySection') return inPlaySection;
            if (id === 'clearInPlayCards') return clearInPlayButton;
            return null;
        }
    };

    try {
        const state = {
            currentDeck: [{ id: 1, card: 'Card A' }],
            inPlayCards: []
        };
        const { updateInPlayCardsDisplay } = loadCardActions(state);

        updateInPlayCardsDisplay();

        assert.strictEqual(inPlaySection.style.display, 'block',
            'In-play section should remain visible while a deck exists');
        assert(inPlayContainer.innerHTML.includes('No cards in play.'),
            'Empty active decks should show the in-play empty state');
        assert.strictEqual(clearInPlayButton.hidden, true,
            'Clear All should be hidden when there are no in-play cards');
        assert.strictEqual(clearInPlayButton.disabled, true,
            'Clear All should be disabled when there are no in-play cards');
    } finally {
        global.document = previousDocument;
    }
}

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
// Test: shuffleCardIntoTopN does not remove existing card on exhausted deck
// ============================
{
    const toasts = [];
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
    const { shuffleCardIntoTopN } = loadCardActions(state, {
        showToast: (message) => toasts.push(message)
    });

    shuffleCardIntoTopN(1, 3);

    assert.deepStrictEqual(state.currentDeck.map(card => card.id), [1, 2],
        'shuffleCardIntoTopN should leave the deck unchanged when there are no remaining cards');
    assert.strictEqual(state.currentIndex, 1,
        'shuffleCardIntoTopN should preserve the active index when no shuffle occurs');
    assert.deepStrictEqual(toasts, ['No remaining cards to shuffle into.']);
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

// ============================
// Test: insertSpecificCardById routes to next/bottom positions
// ============================
{
    const toasts = [];
    const state = {
        currentDeck: [
            { id: 1, card: 'A' },
            { id: 2, card: 'B' }
        ],
        currentIndex: 0,
        availableCards: [
            { id: 1, card: 'A' },
            { id: 2, card: 'B' },
            { id: 3, card: 'C' },
            { id: 4, card: 'D' }
        ],
        cards: { selected: new Map([[1, true], [2, true]]) }
    };
    const { insertSpecificCardById } = loadCardActions(state, {
        showToast: (message) => toasts.push(message)
    });

    insertSpecificCardById(3, 'next');
    insertSpecificCardById(4, 'bottom');

    assert.deepStrictEqual(state.currentDeck.map(card => card.id), [1, 3, 2, 4]);
    assert.strictEqual(state.cards.selected.has(3), true);
    assert.strictEqual(state.cards.selected.has(4), true);
    assert.deepStrictEqual(toasts, [
        'Inserted "C" into the deck (next).',
        'Inserted "D" into the deck (bottom).'
    ]);
}

// ============================
// Test: shuffleCardIntoTopN removes moved cards from discard pile
// ============================
{
    const state = {
        currentDeck: [
            { id: 1, card: 'A' },
            { id: 2, card: 'B' }
        ],
        currentIndex: 0,
        discardPile: [
            { id: 3, card: 'C' }
        ],
        availableCards: [
            { id: 1, card: 'A' },
            { id: 2, card: 'B' },
            { id: 3, card: 'C' }
        ],
        cards: { selected: new Map([[1, true], [2, true], [3, true]]) }
    };
    const { shuffleCardIntoTopN } = loadCardActions(state);

    shuffleCardIntoTopN(3, 1);

    assert.deepStrictEqual(state.currentDeck.map(card => card.id), [1, 3, 2],
        'shuffleCardIntoTopN should move the discarded card into the active deck');
    assert.deepStrictEqual(state.discardPile, [],
        'shuffleCardIntoTopN should remove moved cards from the discard pile');
}

console.log('All card action tests passed!');
