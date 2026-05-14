/**
 * Test suite for deck-manager behavior
 * Run with: node tests/deckManager.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadDeckManager(state, document, overrides = {}) {
    const file = path.join(__dirname, '..', 'deck-manager.js');
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/import .*?\r?\n/g, '');
    code = code.replace(/export function /g, 'function ');

    const factory = new Function(
        'state',
        'CONFIG',
        'cardTypeId',
        'shuffleDeck',
        'parseCardTypes',
        'showToast',
        'trackEvent',
        'debounce',
        'saveConfiguration',
        'renderDeckSummary',
        'setActionPanelOpen',
        'setDeckMode',
        'document',
        'Image',
        `${code}; return { generateDeck, showCurrentCard, advanceToNextCard, clearActiveCardView };`
    );

    return factory(
        state,
        overrides.CONFIG || {
            deck: {
                corrupter: { defaultCount: 5 }
            }
        },
        overrides.cardTypeId || ((type) => `type-${type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
        overrides.shuffleDeck || ((deck) => deck),
        overrides.parseCardTypes || ((typeString) => {
            const andGroups = typeString.split('+').map(group =>
                group.trim().split('/').map(option => option.trim())
            );
            return { andGroups, allTypes: [...new Set(andGroups.flat())] };
        }),
        overrides.showToast || (() => { }),
        overrides.trackEvent || (() => { }),
        overrides.debounce || ((fn) => fn),
        overrides.saveConfiguration || (() => { }),
        overrides.renderDeckSummary || (() => { }),
        overrides.setActionPanelOpen || (() => { }),
        overrides.setDeckMode || (() => { }),
        document,
        overrides.Image || function TestImage() { }
    );
}

function makeClassList() {
    return {
        values: new Set(),
        add(value) {
            this.values.add(value);
        },
        remove(value) {
            this.values.delete(value);
        }
    };
}

function makeDeckGenerationDocument(inputValues) {
    const elements = {
        activeDeckSection: { style: {} },
        navigationButtons: { style: {} },
        deckProgress: { style: {} },
        cardActionSection: { style: {} },
        cardActionContent: {
            classList: makeClassList()
        }
    };

    Object.entries(inputValues).forEach(([type, value]) => {
        elements[`type-${type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`] = {
            value: String(value),
            max: '99'
        };
    });

    return {
        getElementById(id) {
            return elements[id] || null;
        },
        querySelector() {
            return {
                classList: makeClassList(),
                setAttribute() { }
            };
        }
    };
}

function makeBaseState() {
    return {
        selectedGames: ['Test Game'],
        allCardTypes: [],
        dataStore: {
            sentryTypes: [],
            corrupterTypes: [],
            heldBackCardTypes: []
        },
        cards: {
            selected: new Map()
        },
        deck: {
            main: [],
            special: [],
            combined: []
        },
        currentDeck: [],
        currentIndex: -1,
        discardPile: [],
        sentryDeck: [],
        setAsideCards: [],
        availableCards: [],
        deckDataByType: {},
        enableSentryRules: false,
        enableCorrupterRules: false,
        initialDeckSize: 0,
        inPlayCards: []
    };
}

console.log('Testing deck-manager behavior...');

// ============================
// Test: held-back cards can be selected by their configured counts
// ============================
{
    const state = makeBaseState();
    state.allCardTypes = ['Denizen', 'Novice', 'Veteran'];
    state.dataStore.heldBackCardTypes = ['Novice', 'Veteran'];
    state.availableCards = [
        { id: 1, card: 'Denizen A', type: 'Denizen', contents: 'a.png' },
        { id: 2, card: 'Novice A', type: 'Novice', contents: 'b.png' },
        { id: 3, card: 'Veteran A', type: 'Veteran', contents: 'c.png' }
    ];
    state.deckDataByType = {
        Denizen: [state.availableCards[0]],
        Novice: [state.availableCards[1]],
        Veteran: [state.availableCards[2]]
    };

    const document = makeDeckGenerationDocument({
        Denizen: 1,
        Novice: 1,
        Veteran: 1
    });
    const { generateDeck } = loadDeckManager(state, document);

    generateDeck();

    assert.deepStrictEqual(
        state.currentDeck.map(card => card.id),
        [1, 2, 3],
        'Deck generation should include held-back cards when their counts are greater than zero'
    );
}

// ============================
// Test: corrupter replacement does not append duplicate corrupter cards
// ============================
{
    const state = makeBaseState();
    state.allCardTypes = ['Denizen', 'Corrupter'];
    state.dataStore.corrupterTypes = ['Corrupter'];
    state.enableCorrupterRules = true;
    state.availableCards = [
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
    state.deckDataByType = {
        Denizen: state.availableCards.slice(0, 5),
        Corrupter: state.availableCards.slice(5)
    };

    const document = makeDeckGenerationDocument({
        Denizen: 5,
        Corrupter: 5
    });
    const { generateDeck } = loadDeckManager(state, document);

    generateDeck();

    const corrupterIds = state.currentDeck
        .filter(card => card.type === 'Corrupter')
        .map(card => card.id);
    assert.strictEqual(corrupterIds.length, 5,
        'Corrupter rules should add exactly five corrupter replacements');
    assert.strictEqual(new Set(corrupterIds).size, 5,
        'Corrupter replacements should not duplicate cards already selected as special cards');
    assert.strictEqual(state.currentDeck.length, 5,
        'Corrupter replacements should replace regular cards instead of appending a second special deck');
}

// ============================
// Test: showCurrentCard preserves the clear-active button
// ============================
{
    const state = makeBaseState();
    state.currentDeck = [{ id: 1, card: 'Card A', type: 'Denizen', contents: 'a.png' }];
    state.currentIndex = 0;

    const clearButton = { style: {}, removed: false };
    const output = {
        querySelector() {
            return null;
        },
        appendChild() { },
        set innerHTML(value) {
            this._innerHTML = value;
            clearButton.removed = true;
        },
        get innerHTML() {
            return this._innerHTML || '';
        }
    };
    const document = {
        createElement() {
            return {
                className: '',
                innerHTML: '',
                appendChild() { },
                querySelector() { return null; }
            };
        },
        getElementById(id) {
            if (id === 'deckOutput') return output;
            if (id === 'clearActiveCard') return clearButton.removed ? null : clearButton;
            return null;
        }
    };

    const { showCurrentCard } = loadDeckManager(state, document);
    showCurrentCard();

    assert.strictEqual(clearButton.removed, false,
        'showCurrentCard should not replace the deck output container and remove the clear button');
    assert.strictEqual(clearButton.style.display, 'block',
        'showCurrentCard should keep the clear button visible for an active card');
}

// ============================
// Test: clearing an active card pauses on the card back without advancing
// ============================
{
    const state = makeBaseState();
    state.currentDeck = [
        { id: 1, card: 'Card A', type: 'Denizen', contents: 'a.png' },
        { id: 2, card: 'Card B', type: 'Denizen', contents: 'b.png' }
    ];
    state.currentIndex = 1;
    state.discardPile = [state.currentDeck[0]];

    const elements = {
        deckOutput: {
            querySelector() {
                return {
                    innerHTML: ''
                };
            }
        },
        clearActiveCard: { style: {} }
    };
    const document = {
        getElementById(id) {
            return elements[id] || null;
        },
        createElement() {
            return { className: '', innerHTML: '' };
        }
    };

    const { clearActiveCardView, advanceToNextCard } = loadDeckManager(state, document);
    clearActiveCardView();

    assert.strictEqual(state.currentIndex, 1,
        'Clearing the active card should keep the deck positioned at the same card');
    assert.strictEqual(state.discardPile.length, 1,
        'Clearing the active card should not mutate the discard pile');

    advanceToNextCard();

    assert.strictEqual(state.currentIndex, 1,
        'The next draw after clearing should reveal the same card rather than skipping it');
    assert.deepStrictEqual(state.discardPile.map(card => card.id), [1],
        'The next draw after clearing should not duplicate the previous card in the discard pile');
}

console.log('All deck-manager behavior tests passed!');
