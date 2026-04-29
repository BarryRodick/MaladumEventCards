/**
 * Test suite for live deck click guard behavior
 * Run with: node tests/deckClickGuard.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadShouldAdvanceDeckFromClick() {
    const file = path.join(__dirname, '..', 'events.js');
    const code = fs.readFileSync(file, 'utf8');
    const match = code.match(/function shouldAdvanceDeckFromClick\(target\) \{[\s\S]*?\n\}/);
    if (!match) {
        throw new Error('shouldAdvanceDeckFromClick function not found');
    }

    return new Function(`${match[0]}; return shouldAdvanceDeckFromClick;`)();
}

function createTarget(matches = {}) {
    return {
        closest(selector) {
            return matches[selector] || null;
        }
    };
}

console.log('Testing live deck click guard...');

const shouldAdvanceDeckFromClick = loadShouldAdvanceDeckFromClick();

assert.strictEqual(
    shouldAdvanceDeckFromClick(createTarget({
        '[data-deck-surface="true"]': {}
    })),
    true,
    'Clicks on the deck surface should advance the deck'
);

assert.strictEqual(
    shouldAdvanceDeckFromClick(createTarget({
        '[data-deck-surface="true"]': {},
        '#clearActiveCard': {}
    })),
    false,
    'Clicks on the clear button should not advance the deck'
);

assert.strictEqual(
    shouldAdvanceDeckFromClick(createTarget({})),
    false,
    'Clicks outside the deck surface should not advance the deck'
);

assert.strictEqual(
    shouldAdvanceDeckFromClick(null),
    false,
    'Missing click targets should fail closed'
);

console.log('All live deck click guard tests passed!');
