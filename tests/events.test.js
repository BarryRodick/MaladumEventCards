/**
 * Source-level event wiring checks
 * Run with: node tests/events.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'events.js'), 'utf8');

console.log('Testing event wiring source...');

{
    assert(!source.includes('state.currentDeck.length > 0 && state.currentIndex >= 0'),
        'Rebuild confirmation should trigger whenever an active deck exists, even before the first draw');
}

{
    const deckOutputBlock = source.match(/const deckOutput[\s\S]*?\/\/ Card Actions/);
    assert(deckOutputBlock, 'events.js should contain deckOutput event wiring');
    assert(!deckOutputBlock[0].includes('advanceToNextCard();'),
        'Clicking the active card image should not advance the deck');
    assert(deckOutputBlock[0].includes('showCardPreview'),
        'Clicking the active card image should open the preview modal');
}

{
    const clearInPlayBlock = source.match(/const clearInPlayBtn[\s\S]*?const cardSearchInput/);
    assert(clearInPlayBlock, 'events.js should contain clear-in-play event wiring');
    assert(clearInPlayBlock[0].includes('state.inPlayCards.length'),
        'Clear All should check whether cards are currently in play');
    assert(clearInPlayBlock[0].includes('confirm('),
        'Clear All should confirm before clearing cards in play');
}

console.log('All event wiring source tests passed!');
