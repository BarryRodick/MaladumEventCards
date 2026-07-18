/**
 * UI event contract: accessible previews and liveDeckSession action routing.
 * Run with: node tests/eventsUiContract.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadSourceModule } = require('./helpers/load-source-module');

function makeEventTarget(dataset = {}) {
    const listeners = new Map();
    return {
        dataset,
        classList: { contains: () => false },
        addEventListener(type, listener) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(listener);
        },
        dispatch(type, event = {}) {
            const completeEvent = {
                target: this,
                preventDefault() { },
                stopPropagation() { },
                ...event
            };
            (listeners.get(type) || []).forEach(listener => listener(completeEvent));
        },
        getAttribute(name) {
            return this.attributes?.[name] || null;
        }
    };
}

const source = fs.readFileSync(path.join(__dirname, '..', 'events.js'), 'utf8');
assert(source.includes("from './live-deck-session.js'"),
    'UI actions must use the live deck session boundary');
assert(!source.includes("from './card-actions.js'"),
    'The retired card-actions module must not be reintroduced');
assert(!source.includes('advanceToNextCard'),
    'Previewing the active card must not restore click-to-advance deck behavior');

const deckOutput = makeEventTarget();
const searchResults = makeEventTarget();
const inPlayCards = makeEventTarget();
const shuffleButton = makeEventTarget();
const insertNextButton = makeEventTarget();
const addBottomButton = makeEventTarget();
const modal = makeEventTarget({ cardId: '42' });
const shuffleCount = Object.assign(makeEventTarget(), { value: '6' });

const elements = {
    deckOutput,
    cardSearchResults: searchResults,
    inPlayCards,
    cardPreviewModal: modal,
    cardPreviewShuffleCount: shuffleCount
};

const document = {
    getElementById(id) {
        return elements[id] || null;
    },
    querySelector(selector) {
        if (selector === '[data-card-preview-shuffle]') return shuffleButton;
        if (selector === '[data-card-preview-insert-next]') return insertNextButton;
        if (selector === '[data-card-preview-add-bottom]') return addBottomButton;
        return null;
    },
    querySelectorAll() {
        return [];
    },
    createElement() {
        return makeEventTarget();
    }
};

const richCard = {
    id: 42,
    card: 'Grave Matters',
    type: 'Dungeon',
    game: 'Beyond The Vaults',
    renderMode: 'rich',
    sections: [{ label: 'DISQUIET', text: 'Search the nearest grave.' }]
};
const state = {
    currentDeck: [{ id: 7 }],
    inPlayCards: [],
    cardMap: new Map([[42, richCard]]),
    allCardTypes: [],
    deckDataByType: {}
};
const previewCalls = [];
const actionCalls = [];
const requestCalls = [];
let preventedKeyboardDefault = false;

const liveDeckSession = {
    advance() { },
    previous() { },
    performAction() { },
    markActiveInPlay() { },
    clearActive() { },
    clearInPlay() { },
    removeFromPlay() { },
    shuffleIntoTop(cardId, count) {
        actionCalls.push({ kind: 'shuffleTopN', cardId, count });
    },
    insertCard(cardId, position) {
        actionCalls.push({ kind: 'insertSpecificCard', cardId, position });
    }
};

const { setupEventListeners } = loadSourceModule('events.js', {
    dependencies: {
        generateDeck() { },
        liveDeckSession,
        state,
        trackEvent() { },
        debounce: fn => fn,
        saveConfiguration() { },
        setupManualUpdateCheck() { },
        updateCardSearchResults() { },
        showCardPreview(request) {
            previewCalls.push(request);
        },
        setDeckMode() { },
        toggleUtilityDrawer() { },
        openBuildTools() { },
        openSearchTools() { },
        toggleActionPanel() { },
        renderDeckSummary() { },
        buildPreviewActionRequest(actionName, dataset, options) {
            requestCalls.push({ actionName, dataset: { ...dataset }, options });
            if (actionName === 'shuffleTopN') {
                return { kind: 'shuffleTopN', cardId: 42, count: Number(options.count) };
            }
            return {
                kind: 'insertSpecificCard',
                cardId: 42,
                position: actionName === 'insertNext' ? 'next' : 'bottom'
            };
        },
        document
    },
    exports: ['setupEventListeners']
});

setupEventListeners();

const searchItem = makeEventTarget({ cardId: '42' });
searchItem.closest = selector => selector === '.card-search-item' ? searchItem : null;
searchResults.dispatch('click', { target: searchItem });
assert.strictEqual(previewCalls.length, 1);
assert.strictEqual(previewCalls[0].card, richCard,
    'Catalog results should preview the normalized card selected from cardMap');

const activePreviewButton = makeEventTarget({
    cardId: '42',
    cardName: richCard.card,
    cardType: richCard.type,
    cardImage: 'grave-matters.png'
});
activePreviewButton.closest = selector => selector === '[data-active-card-preview]'
    ? activePreviewButton
    : null;
deckOutput.dispatch('keydown', {
    key: ' ',
    target: activePreviewButton,
    preventDefault() {
        preventedKeyboardDefault = true;
    }
});
assert.strictEqual(preventedKeyboardDefault, true);
assert.strictEqual(previewCalls.length, 2);
assert.strictEqual(previewCalls[1].card, richCard,
    'Enter/Space on the semantic active-card button should open the rich preview');

const inPlayPreviewButton = makeEventTarget({
    cardId: '42',
    cardName: richCard.card,
    cardType: richCard.type,
    cardImage: 'grave-matters.png'
});
inPlayPreviewButton.closest = selector => selector === '.in-play-card-preview'
    ? inPlayPreviewButton
    : null;
inPlayCards.dispatch('keydown', {
    key: 'Enter',
    target: inPlayPreviewButton
});
assert.strictEqual(previewCalls.length, 3);
assert.strictEqual(previewCalls[2].card, richCard,
    'Enter/Space on an in-play card button should open the same rich preview');

shuffleButton.dispatch('click');
insertNextButton.dispatch('click');
addBottomButton.dispatch('click');

assert.deepStrictEqual(requestCalls.map(call => call.actionName), [
    'shuffleTopN',
    'insertNext',
    'addToBottom'
]);
assert.deepStrictEqual(actionCalls, [
    { kind: 'shuffleTopN', cardId: 42, count: 6 },
    { kind: 'insertSpecificCard', cardId: 42, position: 'next' },
    { kind: 'insertSpecificCard', cardId: 42, position: 'bottom' }
], 'Preview actions should stay routed through liveDeckSession');

console.log('All UI event contracts passed!');
