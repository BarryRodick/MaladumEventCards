/**
 * Test suite for deck flow helpers
 * Run with: node tests/deckFlowUtils.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadDeckFlowUtils() {
    const file = path.join(__dirname, '..', 'deck-flow-utils.js');
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/export function /g, 'function ');

    return new Function(`${code}; return { deriveDeckMode, formatDeckSummary, getGenerateDeckState, buildPreviewActionRequest };`)();
}

const {
    deriveDeckMode,
    formatDeckSummary,
    getGenerateDeckState,
    buildPreviewActionRequest
} = loadDeckFlowUtils();

console.log('Testing deck flow helpers...');

{
    assert.strictEqual(deriveDeckMode({ currentDeckLength: 0 }), 'build');
    assert.strictEqual(deriveDeckMode({ currentDeckLength: 4 }), 'play');
    assert.strictEqual(deriveDeckMode({ currentDeckLength: 4, requestedMode: 'build' }), 'build');
    assert.strictEqual(deriveDeckMode({ currentDeckLength: 0, requestedMode: 'play' }), 'build');
}

{
    const summary = formatDeckSummary({
        selectedGames: ['Maladum', 'Dungeons of Enveron'],
        difficultyName: 'Nightmare',
        enableSentryRules: true,
        enableCorrupterRules: false,
        currentDeckLength: 12,
        currentIndex: -1,
        discardPileLength: 3
    });

    assert.strictEqual(summary.gamesText, 'Maladum + Dungeons of Enveron');
    assert.strictEqual(summary.difficultyText, 'Nightmare');
    assert.strictEqual(summary.remainingCount, 12);
    assert.strictEqual(summary.discardCount, 3);
    assert.strictEqual(summary.statusText, 'Ready to draw');
    assert.strictEqual(summary.showSentryBadge, true);
    assert.strictEqual(summary.showCorrupterBadge, false);
}

{
    const activeSummary = formatDeckSummary({
        selectedGames: ['Maladum'],
        difficultyName: 'Hard',
        currentDeckLength: 10,
        currentIndex: 2,
        discardPileLength: 2,
        currentCardName: 'The Long Hall'
    });

    assert.strictEqual(activeSummary.gamesText, 'Maladum');
    assert.strictEqual(activeSummary.remainingCount, 7);
    assert.strictEqual(activeSummary.statusText, 'The Long Hall');
}

{
    const crowdedSummary = formatDeckSummary({
        selectedGames: ['Base Game', 'Of Ale And Adventure', 'Beyond The Vaults', 'Forbidden Creed']
    });

    assert.strictEqual(crowdedSummary.gamesText, 'Base Game + 3 more');
}

{
    const emptySummary = formatDeckSummary();
    assert.strictEqual(emptySummary.gamesText, 'No games selected');
}

{
    const invalidSetup = getGenerateDeckState({
        selectedGames: ['Base Game'],
        cardCounts: {
            Dungeon: 0,
            Sentry: 2
        },
        sentryTypes: ['Sentry'],
        hasActiveDeck: false
    });

    assert.strictEqual(invalidSetup.canGenerate, false);
    assert.strictEqual(invalidSetup.label, 'Choose Card Counts');
}

{
    const validSetup = getGenerateDeckState({
        selectedGames: ['Base Game'],
        cardCounts: {
            Dungeon: 3
        },
        hasActiveDeck: false
    });

    assert.strictEqual(validSetup.canGenerate, true);
    assert.strictEqual(validSetup.label, 'Generate Deck');
}

{
    const rebuildSetup = getGenerateDeckState({
        selectedGames: ['Base Game'],
        cardCounts: {
            Corrupter: 2
        },
        corrupterTypes: ['Corrupter'],
        enableCorrupterRules: true,
        hasActiveDeck: true
    });

    assert.strictEqual(rebuildSetup.canGenerate, true);
    assert.strictEqual(rebuildSetup.label, 'Rebuild Deck');
}

{
    assert.deepStrictEqual(
        buildPreviewActionRequest('shuffleTopN', { cardId: '42' }, { count: '6' }),
        { kind: 'shuffleTopN', cardId: '42', count: 6 }
    );
    assert.deepStrictEqual(
        buildPreviewActionRequest('insertNext', { cardId: '42' }),
        { kind: 'insertSpecificCard', cardId: '42', position: 'next' }
    );
    assert.deepStrictEqual(
        buildPreviewActionRequest('addToBottom', { cardId: '42' }),
        { kind: 'insertSpecificCard', cardId: '42', position: 'bottom' }
    );
    assert.strictEqual(buildPreviewActionRequest('insertNext', {}), null);
}

console.log('All deck flow helper tests passed!');
