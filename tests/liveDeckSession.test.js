/**
 * Live deck session behavior tests
 * Run with: node tests/liveDeckSession.test.js
 */
const assert = require('assert');
const { loadSourceModule } = require('./helpers/load-source-module');

function loadLiveDeckSession(state, overrides = {}) {
    return loadSourceModule('live-deck-session.js', {
        dependencies: {
            state,
            shuffleDeck: overrides.shuffleDeck || (deck => deck),
            advanceLiveDeck: overrides.advanceLiveDeck || (() => ({ render: false })),
            goToPreviousCard: overrides.goToPreviousCard || (() => false),
            clearActiveCard: overrides.clearActiveCard || (() => false),
            markCardInPlay: overrides.markCardInPlay || (() => false),
            removeCardFromPlay: overrides.removeCardFromPlay || (() => { }),
            clearInPlayCards: overrides.clearInPlayCards || (() => { }),
            liveDeckActions: overrides.liveDeckActions || {},
            shuffleCardIntoTopN: overrides.shuffleCardIntoTopN || (() => ({ ok: false, message: '' })),
            insertSpecificCardById: overrides.insertSpecificCardById || (() => ({ ok: false, message: '' })),
            liveDeckView: overrides.liveDeckView || {
                renderCurrentCard() { },
                renderProgress() { },
                renderInPlayCards() { },
                renderAll() { }
            },
            saveConfiguration: overrides.saveConfiguration || (() => { }),
            showToast: overrides.showToast || (() => { }),
            trackEvent: overrides.trackEvent || (() => { })
        },
        exports: ['liveDeckSession']
    }).liveDeckSession;
}

console.log('Testing live deck session...');

{
    const state = { currentDeck: [], currentIndex: -1 };
    const calls = [];
    const shuffleDeck = deck => deck;
    const session = loadLiveDeckSession(state, {
        shuffleDeck,
        advanceLiveDeck: (...args) => {
            calls.push(['transition', ...args]);
            return { render: true, direction: 'forward', message: 'Deck reshuffled.' };
        },
        liveDeckView: {
            renderCurrentCard: direction => calls.push(['card', direction]),
            renderProgress: () => calls.push(['progress']),
            renderInPlayCards() { },
            renderAll() { }
        },
        saveConfiguration: () => calls.push(['save']),
        showToast: message => calls.push(['toast', message])
    });

    session.advance();

    assert.deepStrictEqual(calls, [
        ['transition', state, { shuffle: shuffleDeck }],
        ['toast', 'Deck reshuffled.'],
        ['card', 'forward'],
        ['progress'],
        ['save']
    ]);
}

{
    const state = { currentDeck: [{ id: 1 }], currentIndex: 0 };
    const calls = [];
    const session = loadLiveDeckSession(state, {
        goToPreviousCard: receivedState => {
            calls.push(['transition', receivedState]);
            return true;
        },
        liveDeckView: {
            renderCurrentCard: direction => calls.push(['card', direction]),
            renderProgress: () => calls.push(['progress']),
            renderInPlayCards() { },
            renderAll() { }
        },
        saveConfiguration: () => calls.push(['save']),
        trackEvent: (...args) => calls.push(['track', ...args])
    });

    session.previous();

    assert.deepStrictEqual(calls, [
        ['transition', state],
        ['card', 'backward'],
        ['progress'],
        ['save'],
        ['track', 'Navigation', 'Previous Card', 0]
    ]);
}

{
    const activeCard = { id: 7, card: 'Wanderer' };
    const state = { currentDeck: [activeCard], currentIndex: 0, inPlayCards: [] };
    const calls = [];
    const session = loadLiveDeckSession(state, {
        markCardInPlay: (...args) => {
            calls.push(['transition', ...args]);
            return true;
        },
        liveDeckView: {
            renderCurrentCard() { },
            renderProgress: () => calls.push(['progress']),
            renderInPlayCards: () => calls.push(['in-play']),
            renderAll() { }
        },
        saveConfiguration: () => calls.push(['save']),
        showToast: message => calls.push(['toast', message]),
        trackEvent: (...args) => calls.push(['track', ...args])
    });

    session.markActiveInPlay();

    assert.deepStrictEqual(calls, [
        ['transition', state, activeCard],
        ['in-play'],
        ['progress'],
        ['toast', 'Card "Wanderer" marked as in play.'],
        ['save'],
        ['track', 'Card Status', 'Mark In Play', 'Wanderer']
    ]);
}

{
    const state = { currentDeck: [{ id: 1 }], currentIndex: 0 };
    const calls = [];
    const session = loadLiveDeckSession(state, {
        clearActiveCard: receivedState => {
            calls.push(['transition', receivedState]);
            return true;
        },
        liveDeckView: {
            renderCurrentCard: direction => calls.push(['card', direction]),
            renderProgress: () => calls.push(['progress']),
            renderInPlayCards() { },
            renderAll() { }
        },
        saveConfiguration: () => calls.push(['save']),
        trackEvent: (...args) => calls.push(['track', ...args])
    });

    session.clearActive();

    assert.deepStrictEqual(calls, [
        ['transition', state],
        ['card', undefined],
        ['progress'],
        ['save'],
        ['track', 'Navigation', 'Clear Active Card', null]
    ]);
}

{
    const state = { inPlayCards: [{ id: 1 }] };
    const calls = [];
    const session = loadLiveDeckSession(state, {
        clearInPlayCards: receivedState => calls.push(['transition', receivedState]),
        liveDeckView: {
            renderCurrentCard() { },
            renderProgress: () => calls.push(['progress']),
            renderInPlayCards: () => calls.push(['in-play']),
            renderAll() { }
        },
        saveConfiguration: () => calls.push(['save']),
        trackEvent: (...args) => calls.push(['track', ...args])
    });

    session.clearInPlay();

    assert.deepStrictEqual(calls, [
        ['transition', state],
        ['in-play'],
        ['progress'],
        ['save'],
        ['track', 'Card Status', 'Clear In Play', null]
    ]);
}

{
    const state = { inPlayCards: [{ id: 12 }] };
    const calls = [];
    const session = loadLiveDeckSession(state, {
        removeCardFromPlay: (...args) => calls.push(['transition', ...args]),
        liveDeckView: {
            renderCurrentCard() { },
            renderProgress: () => calls.push(['progress']),
            renderInPlayCards: () => calls.push(['in-play']),
            renderAll() { }
        },
        saveConfiguration: () => calls.push(['save'])
    });

    session.removeFromPlay(12);

    assert.deepStrictEqual(calls, [
        ['transition', state, 12],
        ['in-play'],
        ['progress'],
        ['save']
    ]);
}

{
    const activeCard = { id: 1, card: 'A' };
    const state = { currentDeck: [activeCard], currentIndex: 0 };
    const calls = [];
    const session = loadLiveDeckSession(state, {
        liveDeckActions: {
            shuffleAnywhere: (...args) => {
                calls.push(['transition', ...args]);
                return { message: 'Action complete.', render: true, direction: 'backward' };
            }
        },
        liveDeckView: {
            renderCurrentCard: direction => calls.push(['card', direction]),
            renderProgress: () => calls.push(['progress']),
            renderInPlayCards: () => calls.push(['in-play']),
            renderAll() { }
        },
        saveConfiguration: () => calls.push(['save']),
        showToast: message => calls.push(['toast', message]),
        trackEvent: (...args) => calls.push(['track', ...args])
    });

    session.performAction('shuffleAnywhere', 7);

    assert.deepStrictEqual(calls, [
        ['transition', state, activeCard, 7],
        ['card', 'backward'],
        ['progress'],
        ['in-play'],
        ['toast', 'Action complete.'],
        ['save'],
        ['track', 'Card Action', 'shuffleAnywhere', 'A']
    ]);
}

{
    const state = { currentDeck: [{ id: 1 }], currentIndex: 0 };
    const card = { id: 3, card: 'C' };
    const calls = [];
    const session = loadLiveDeckSession(state, {
        shuffleCardIntoTopN: (...args) => {
            calls.push(['transition', ...args]);
            return { ok: true, card, message: 'Shuffled C.' };
        },
        liveDeckView: {
            renderCurrentCard: direction => calls.push(['card', direction]),
            renderProgress: () => calls.push(['progress']),
            renderInPlayCards() { },
            renderAll() { }
        },
        saveConfiguration: () => calls.push(['save']),
        showToast: message => calls.push(['toast', message]),
        trackEvent: (...args) => calls.push(['track', ...args])
    });

    session.shuffleIntoTop(3, 5);

    assert.deepStrictEqual(calls, [
        ['transition', state, 3, 5],
        ['toast', 'Shuffled C.'],
        ['card', undefined],
        ['progress'],
        ['save'],
        ['track', 'Card Action', 'shuffleTopNCard', 'C']
    ]);
}

{
    const state = { currentDeck: [{ id: 1 }], currentIndex: 0 };
    const card = { id: 4, card: 'D' };
    const calls = [];
    const session = loadLiveDeckSession(state, {
        insertSpecificCardById: (...args) => {
            calls.push(['transition', ...args]);
            return { ok: true, card, message: 'Inserted D.' };
        },
        liveDeckView: {
            renderCurrentCard: direction => calls.push(['card', direction]),
            renderProgress: () => calls.push(['progress']),
            renderInPlayCards() { },
            renderAll() { }
        },
        saveConfiguration: () => calls.push(['save']),
        showToast: message => calls.push(['toast', message]),
        trackEvent: (...args) => calls.push(['track', ...args])
    });

    session.insertCard(4, 'bottom');

    assert.deepStrictEqual(calls, [
        ['transition', state, 4, 'bottom'],
        ['toast', 'Inserted D.'],
        ['card', undefined],
        ['progress'],
        ['save'],
        ['track', 'Card Action', 'insertSpecificCard:bottom', 'D']
    ]);
}

{
    let renderCalls = 0;
    const session = loadLiveDeckSession({}, {
        liveDeckView: {
            renderCurrentCard() { },
            renderProgress() { },
            renderInPlayCards() { },
            renderAll() { renderCalls++; }
        }
    });

    session.present();

    assert.strictEqual(renderCalls, 1);
}

console.log('All live deck session tests passed!');
