/**
 * Test suite for card actions
 * Run with: node tests/cardActions.test.js
 */
const assert = require('assert');
const { loadSourceModule } = require('./helpers/load-source-module');

function loadCardActions(state, overrides = {}) {
    const parseCardTypes = overrides.parseCardTypes || ((typeString = '') => {
        const andGroups = typeString.split('+').map(group =>
            group.trim().split('/').map(option => option.trim())
        );
        return { andGroups, allTypes: [...new Set(andGroups.flat())] };
    });
    const shuffleDeck = overrides.shuffleDeck || ((deck) => deck);
    const liveDeck = loadSourceModule('live-deck.js', {
        dependencies: { parseCardTypes, shuffleDeck },
        exports: [
            'insertSpecificCardById',
            'liveDeckActions',
            'markCardInPlay',
            'removeCardFromPlay',
            'shuffleCardIntoTopN'
        ]
    });

    return loadSourceModule('card-actions.js', {
        dependencies: {
            state,
            showToast: overrides.showToast || (() => { }),
            trackEvent: overrides.trackEvent || (() => { }),
            saveConfiguration: overrides.saveConfiguration || (() => { }),
            showCurrentCard: overrides.showCurrentCard || (() => { }),
            updateProgressBar: overrides.updateProgressBar || (() => { }),
            insertSpecificCardIntoLiveDeck: overrides.insertSpecificCardIntoLiveDeck || liveDeck.insertSpecificCardById,
            liveDeckActions: overrides.liveDeckActions || liveDeck.liveDeckActions,
            markCardInPlay: overrides.markCardInPlay || liveDeck.markCardInPlay,
            removeLiveCardFromPlay: overrides.removeLiveCardFromPlay || liveDeck.removeCardFromPlay,
            shuffleLiveCardIntoTopN: overrides.shuffleLiveCardIntoTopN || liveDeck.shuffleCardIntoTopN
        },
        exports: [
            'markCardAsInPlay',
            'updateInPlayCardsDisplay',
            'shuffleCardIntoTopN',
            'insertSpecificCardById',
            'triggerCardAction'
        ]
    });
}

console.log('Testing card actions...');

assert.throws(
    () => loadSourceModule('card-actions.js', { exports: ['cardActions'] }),
    error => error.message.includes('Requested export was not found: cardActions'),
    'card-actions should not expose a second domain action registry'
);

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

{
    const toasts = [];
    let progressCalls = 0;
    let saveCalls = 0;
    let renderCalls = 0;
    let telemetryCalls = 0;
    const { shuffleCardIntoTopN } = loadCardActions({}, {
        shuffleLiveCardIntoTopN: () => ({
            ok: false,
            message: 'No remaining cards to shuffle into.'
        }),
        showToast: message => toasts.push(message),
        updateProgressBar: () => { progressCalls++; },
        saveConfiguration: () => { saveCalls++; },
        showCurrentCard: () => { renderCalls++; },
        trackEvent: () => { telemetryCalls++; }
    });

    shuffleCardIntoTopN(1, 3);

    assert.deepStrictEqual(toasts, ['No remaining cards to shuffle into.']);
    assert.strictEqual(progressCalls, 0);
    assert.strictEqual(saveCalls, 0);
    assert.strictEqual(renderCalls, 0);
    assert.strictEqual(telemetryCalls, 0);
}

{
    const commandCalls = [];
    const toasts = [];
    const telemetry = [];
    let progressCalls = 0;
    let saveCalls = 0;
    let renderCalls = 0;
    const state = {};
    const { insertSpecificCardById } = loadCardActions(state, {
        insertSpecificCardIntoLiveDeck: (...args) => {
            commandCalls.push(args);
            return {
                ok: true,
                card: { id: 3, card: 'C' },
                message: 'Inserted "C" into the deck (bottom).'
            };
        },
        showToast: message => toasts.push(message),
        updateProgressBar: () => { progressCalls++; },
        saveConfiguration: () => { saveCalls++; },
        showCurrentCard: () => { renderCalls++; },
        trackEvent: (...args) => telemetry.push(args)
    });

    insertSpecificCardById(3, 'bottom');

    assert.deepStrictEqual(commandCalls, [[state, 3, 'bottom']]);
    assert.deepStrictEqual(toasts, ['Inserted "C" into the deck (bottom).']);
    assert.strictEqual(progressCalls, 1);
    assert.strictEqual(saveCalls, 1);
    assert.strictEqual(renderCalls, 1);
    assert.deepStrictEqual(telemetry, [['Card Action', 'insertSpecificCard:bottom', 'C']]);
}

{
    const toasts = [];
    let actionCalls = 0;
    let sideEffectCalls = 0;
    const { triggerCardAction } = loadCardActions({
        currentDeck: [],
        currentIndex: -1
    }, {
        liveDeckActions: {
            shuffleAnywhere() { actionCalls++; }
        },
        showToast: message => toasts.push(message),
        updateProgressBar: () => { sideEffectCalls++; },
        saveConfiguration: () => { sideEffectCalls++; },
        showCurrentCard: () => { sideEffectCalls++; },
        trackEvent: () => { sideEffectCalls++; }
    });

    triggerCardAction('shuffleAnywhere');

    assert.deepStrictEqual(toasts, ['No active card to perform action on.']);
    assert.strictEqual(actionCalls, 0);
    assert.strictEqual(sideEffectCalls, 0);
}

{
    const activeCard = { id: 1, card: 'A' };
    const errors = [];
    let sideEffectCalls = 0;
    const originalConsoleError = console.error;
    const { triggerCardAction } = loadCardActions({
        currentDeck: [activeCard],
        currentIndex: 0
    }, {
        liveDeckActions: {},
        showToast: () => { sideEffectCalls++; },
        updateProgressBar: () => { sideEffectCalls++; },
        saveConfiguration: () => { sideEffectCalls++; },
        showCurrentCard: () => { sideEffectCalls++; },
        trackEvent: () => { sideEffectCalls++; }
    });

    try {
        console.error = message => errors.push(message);
        triggerCardAction('unknownAction');
    } finally {
        console.error = originalConsoleError;
    }

    assert.deepStrictEqual(errors, ['Action unknownAction not found']);
    assert.strictEqual(sideEffectCalls, 0);
}

{
    const previousDocument = global.document;
    const activeCard = { id: 1, card: 'A' };
    const actionCalls = [];
    const toasts = [];
    const renderDirections = [];
    const telemetry = [];
    let progressCalls = 0;
    let saveCalls = 0;
    const inPlayContainer = {
        innerHTML: '',
        querySelectorAll() { return []; }
    };
    const inPlaySection = { style: {} };
    const clearInPlayButton = {};

    global.document = {
        getElementById(id) {
            if (id === 'inPlayCards') return inPlayContainer;
            if (id === 'inPlaySection') return inPlaySection;
            if (id === 'clearInPlayCards') return clearInPlayButton;
            return null;
        }
    };

    try {
        const state = {
            currentDeck: [activeCard],
            currentIndex: 0,
            inPlayCards: []
        };
        const { triggerCardAction } = loadCardActions(state, {
            liveDeckActions: {
                shuffleAnywhere(...args) {
                    actionCalls.push(args);
                    return {
                        message: 'Action complete.',
                        render: true,
                        direction: 'backward',
                        progress: true
                    };
                }
            },
            showToast: message => toasts.push(message),
            showCurrentCard: direction => renderDirections.push(direction),
            updateProgressBar: () => { progressCalls++; },
            saveConfiguration: () => { saveCalls++; },
            trackEvent: (...args) => telemetry.push(args)
        });

        triggerCardAction('shuffleAnywhere', 7);

        assert.deepStrictEqual(actionCalls, [[state, activeCard, 7]]);
        assert.deepStrictEqual(renderDirections, ['backward']);
        assert.strictEqual(progressCalls, 2,
            'The domain progress flag and in-play refresh should both update progress');
        assert.deepStrictEqual(toasts, ['Action complete.']);
        assert.strictEqual(inPlaySection.style.display, 'block');
        assert(inPlayContainer.innerHTML.includes('No cards in play.'));
        assert.strictEqual(saveCalls, 1);
        assert.deepStrictEqual(telemetry, [['Card Action', 'shuffleAnywhere', 'A']]);
    } finally {
        global.document = previousDocument;
    }
}

console.log('All card action tests passed!');
