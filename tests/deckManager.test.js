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
        exports: ['buildDeck', 'DECK_RULE_ERRORS']
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
            rebuildSelectedCardsMap: overrides.rebuildSelectedCardsMap || rebuildSelectedCardsMap,
            showToast: overrides.showToast || (() => { }),
            trackEvent: overrides.trackEvent || (() => { }),
            saveConfiguration: overrides.saveConfiguration || (() => { }),
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
