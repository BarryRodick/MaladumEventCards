/**
 * Test suite for deck-manager behavior
 * Run with: node tests/deckManager.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadSourceModule } = require('./helpers/load-source-module');

function loadDeckManager(state, document, overrides = {}) {
    const parseCardTypes = overrides.parseCardTypes || ((typeString) => {
        const andGroups = typeString.split('+').map(group =>
            group.trim().split('/').map(option => option.trim())
        );
        return { andGroups, allTypes: [...new Set(andGroups.flat())] };
    });
    const shuffleDeck = overrides.shuffleDeck || ((deck) => deck);
    const deckRules = loadSourceModule('deck-rules.js', {
        dependencies: { parseCardTypes, shuffleDeck },
        exports: ['buildDeck', 'DECK_RULE_ERRORS', 'validateDeckCount']
    });
    const { rebuildSelectedCardsMap } = loadSourceModule('live-deck.js', {
        dependencies: { parseCardTypes, shuffleDeck },
        exports: ['rebuildSelectedCardsMap']
    });

    return loadSourceModule('deck-manager.js', {
        dependencies: {
            state,
            CONFIG: overrides.CONFIG || {
                deck: {
                    corrupter: { defaultCount: 5 }
                }
            },
            cardTypeId: overrides.cardTypeId || ((type) => `type-${type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
            shuffleDeck,
            buildDeck: overrides.buildDeck || deckRules.buildDeck,
            DECK_RULE_ERRORS: deckRules.DECK_RULE_ERRORS,
            validateDeckCount: deckRules.validateDeckCount,
            rebuildSelectedCardsMap: overrides.rebuildSelectedCardsMap || rebuildSelectedCardsMap,
            showToast: overrides.showToast || (() => { }),
            trackEvent: overrides.trackEvent || (() => { }),
            saveConfiguration: overrides.saveConfiguration || (() => { }),
            renderCardCountValidation: overrides.renderCardCountValidation || ((input, validation) => {
                input.setCustomValidity?.(validation.valid ? '' : validation.message);
                if (validation.valid) input.classList?.remove('is-invalid');
                else input.classList?.add('is-invalid');
                input.setAttribute?.('aria-invalid', String(!validation.valid));
                const feedback = document.getElementById(`${input.id}-error`);
                if (feedback) {
                    feedback.textContent = validation.valid ? '' : validation.message;
                    feedback.hidden = validation.valid;
                }
                return validation.valid;
            }),
            setActionPanelOpen: overrides.setActionPanelOpen || (() => { }),
            setDeckMode: overrides.setDeckMode || (() => { }),
            liveDeckView: overrides.liveDeckView || { renderAll() { } },
            document
        },
        exports: ['generateDeck']
    });
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
// Test: missing game selection does not replace a working deck
// ============================
{
    const state = makeBaseState();
    const existingCard = { id: 99, card: 'Existing Deck Card', type: 'Dungeon' };
    state.selectedGames = [];
    state.currentDeck = [existingCard];
    state.deck.main = [existingCard];
    state.deck.combined = [existingCard];

    const { generateDeck } = loadDeckManager(state, makeDeckGenerationDocument({}));
    generateDeck();

    assert.deepStrictEqual(state.currentDeck, [existingCard],
        'A missing game selection must preserve the last working deck');
}

// ============================
// Test: empty card selection does not replace a working deck
// ============================
{
    const state = makeBaseState();
    const existingCard = { id: 99, card: 'Existing Deck Card', type: 'Dungeon' };
    state.currentDeck = [existingCard];
    state.deck.main = [existingCard];
    state.deck.combined = [existingCard];
    state.allCardTypes = ['Denizen'];
    state.availableCards = [{ id: 1, card: 'Denizen A', type: 'Denizen' }];
    state.deckDataByType = { Denizen: state.availableCards };

    const { generateDeck } = loadDeckManager(
        state,
        makeDeckGenerationDocument({ Denizen: 0 })
    );
    generateDeck();

    assert.deepStrictEqual(state.currentDeck, [existingCard],
        'An empty card selection must preserve the last working deck');
}

// ============================
// Test: invalid counts do not replace a working deck
// ============================
{
    const state = makeBaseState();
    const existingCard = { id: 99, card: 'Existing Deck Card', type: 'Dungeon' };
    state.currentDeck = [existingCard];
    state.deck.main = [existingCard];
    state.deck.combined = [existingCard];
    state.allCardTypes = ['Cabal'];
    state.availableCards = [
        { id: 1, card: 'Cabal A', type: 'Cabal' },
        { id: 2, card: 'Cabal B', type: 'Cabal' }
    ];
    state.deckDataByType = { Cabal: state.availableCards };

    const document = makeDeckGenerationDocument({});
    const originalGetElementById = document.getElementById.bind(document);
    document.getElementById = id => id === 'type-cabal'
        ? {
            id: 'type-cabal',
            value: '99',
            max: '99',
            classList: makeClassList(),
            setAttribute() { },
            setCustomValidity() { },
            focus() { },
            reportValidity() { }
        }
        : originalGetElementById(id);

    const { generateDeck } = loadDeckManager(state, document);
    generateDeck();

    assert.deepStrictEqual(state.currentDeck, [existingCard],
        'An invalid requested count must not clear a working deck before validation completes');
}

// ============================
// Test: UI-invalid counts abort before building and focus the first error
// ============================
{
    const state = makeBaseState();
    const existingCard = { id: 99, card: 'Existing Deck Card', type: 'Dungeon' };
    state.currentDeck = [existingCard];
    state.deck.main = [existingCard];
    state.deck.combined = [existingCard];
    state.allCardTypes = ['Cabal', 'Dungeon'];
    state.availableCards = [
        { id: 1, card: 'Cabal A', type: 'Cabal' },
        { id: 2, card: 'Cabal B', type: 'Cabal' },
        { id: 3, card: 'Dungeon A', type: 'Dungeon' }
    ];

    let focusCalls = 0;
    let reportCalls = 0;
    const invalidInput = {
        id: 'type-cabal',
        value: '3',
        max: '2',
        classList: makeClassList(),
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = String(value); },
        setCustomValidity(message) { this.validationMessage = message; },
        focus() { focusCalls++; },
        reportValidity() { reportCalls++; }
    };
    const validInput = {
        id: 'type-dungeon',
        value: '1',
        max: '1',
        classList: makeClassList(),
        setAttribute() { },
        setCustomValidity() { }
    };
    const feedback = { textContent: '', hidden: true };
    const document = makeDeckGenerationDocument({});
    const originalGetElementById = document.getElementById.bind(document);
    document.getElementById = id => ({
        'type-cabal': invalidInput,
        'type-dungeon': validInput,
        'type-cabal-error': feedback
    }[id] || originalGetElementById(id));

    let buildCalls = 0;
    const { generateDeck } = loadDeckManager(state, document, {
        buildDeck() {
            buildCalls++;
            return {
                mainDeck: [state.availableCards[2]],
                specialDeck: [],
                combinedDeck: [state.availableCards[2]],
                sentryDeck: [],
                setAsideCards: []
            };
        }
    });

    generateDeck();

    assert.strictEqual(buildCalls, 0,
        'Generation must stop before building when any visible count field is invalid');
    assert.deepStrictEqual(state.currentDeck, [existingCard],
        'A UI-invalid request must preserve the last working deck');
    assert(feedback.textContent.includes('Requested 3') && feedback.textContent.includes('2 available'),
        'Inline feedback should compare the requested count with the available count');
    assert.strictEqual(feedback.hidden, false);
    assert.strictEqual(invalidInput.attributes['aria-invalid'], 'true');
    assert.strictEqual(focusCalls, 1, 'The first invalid field should receive focus');
    assert.strictEqual(reportCalls, 1, 'The first invalid field should report its validity');
}

// ============================
// Test: newly catalogued Veteran cards remain reachable
// ============================
{
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maladumcards.json'), 'utf8'));
    const newVeteranCards = catalog.games['Base Game'].filter(card => card.id >= 128 && card.id <= 142);
    const state = makeBaseState();
    state.allCardTypes = ['Veteran', 'Dungeon'];
    state.dataStore.heldBackCardTypes = ['Veteran'];
    state.availableCards = newVeteranCards;
    state.deckDataByType = {
        Veteran: newVeteranCards,
        Dungeon: newVeteranCards.filter(card => card.type.includes('Dungeon'))
    };

    const document = makeDeckGenerationDocument({
        Veteran: newVeteranCards.length,
        Dungeon: newVeteranCards.filter(card => card.type.includes('Dungeon')).length
    });
    const { generateDeck } = loadDeckManager(state, document);

    generateDeck();

    assert.strictEqual(newVeteranCards.length, 15, 'The merged catalog should contain all 15 new Veteran cards');
    assert.deepStrictEqual(
        state.currentDeck.map(card => card.id).sort((left, right) => left - right),
        newVeteranCards.map(card => card.id).sort((left, right) => left - right),
        'Held-back deck rules should keep every newly catalogued Veteran card selectable'
    );
}

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
// Test: deck generation refreshes the in-play tray for empty active decks
// ============================
{
    const state = makeBaseState();
    state.allCardTypes = ['Denizen'];
    state.availableCards = [
        { id: 1, card: 'Denizen A', type: 'Denizen', contents: 'a.png' }
    ];
    state.deckDataByType = {
        Denizen: [state.availableCards[0]]
    };

    const document = makeDeckGenerationDocument({
        Denizen: 1
    });
    let inPlayRefreshes = 0;
    const { generateDeck } = loadDeckManager(state, document, {
        liveDeckView: { renderAll: () => { inPlayRefreshes++; } }
    });

    generateDeck();

    assert.strictEqual(inPlayRefreshes, 1,
        'Deck generation should refresh the in-play tray so the empty state remains visible');
    assert.strictEqual(document.getElementById('navigationButtons').style.display, 'grid',
        'Deck generation should let the cockpit navigation use the responsive grid layout');
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

console.log('All deck-manager behavior tests passed!');
