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

    return new Function(`${code}; return { deriveDeckMode, formatDeckSummary, buildPreviewActionRequest };`)();
}

const {
    deriveDeckMode,
    formatDeckSummary,
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

    assert.strictEqual(activeSummary.remainingCount, 7);
    assert.strictEqual(activeSummary.statusText, 'The Long Hall');
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
