/**
 * Source-level checks for live deck cockpit responsive CSS
 * Run with: node tests/liveDeckCss.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const styles = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

console.log('Testing live deck cockpit CSS...');

{
    const mobileBlockMatch = styles.match(/@media \(max-width: 768px\) \{[\s\S]*?#navigationButtons \{[\s\S]*?\n    \}/g);
    assert(mobileBlockMatch,
        'styles.css should contain a mobile #navigationButtons rule');
    const mobileNavigationBlock = mobileBlockMatch[mobileBlockMatch.length - 1];
    assert(styles.includes('#deckExperience[data-mode="play"] #activeDeckSection') &&
        styles.includes('display: flex !important;') &&
        styles.includes('flex-direction: column;'),
        'Mobile play mode should order active deck children explicitly');
    assert(mobileNavigationBlock.includes('position: static;'),
        'Mobile live deck controls should remain in the DM console flow');
    assert(styles.includes('#deckExperience[data-mode="play"] #navigationButtons') &&
        styles.includes('order: 4;'),
        'Mobile live deck controls should follow the card and progress indicator');
    assert(styles.includes('#navigationButtons') &&
        styles.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'),
        'Mobile live deck controls should keep secondary controls readable in two columns');
}

{
    assert(styles.includes('#deckExperience[data-mode="play"] #deckSummaryBar') &&
        styles.includes('order: 1;'),
        'The tactile deck counters should lead the Play surface');
    assert(styles.includes('width: min(100%, 34rem);') &&
        styles.includes('align-self: center;'),
        'The deck counters should stay centred and match the compact Play controls width');
    assert(styles.includes('grid-template-columns: minmax(0, 1fr);') &&
        styles.includes('justify-content: stretch;'),
        'Each deck counter should centre its contents within the full grid quarter');
    assert(styles.includes('#deckExperience[data-mode="play"] .deck-mode-header') &&
        styles.includes('align-items: center;'),
        'The Build and Play switcher should remain centred at wider responsive breakpoints');
    assert(styles.includes('#deckExperience[data-mode="play"] #deckOutput') &&
        styles.includes('order: 2;'),
        'The active event card should follow the deck counters');
    assert(styles.includes("background-image: url('assets/ui/dark-walnut-texture.png');") &&
        styles.includes('background-size: 760px 760px;'),
        'The Play surface should use the real dark-walnut tabletop texture');
    assert(styles.includes('.play-utility-nav') &&
        styles.includes('grid-template-columns: repeat(3, minmax(0, 1fr));'),
        'Play utilities should form a compact three-control footer');
}

{
    assert(styles.includes('.rune-btn.next-draw') && styles.includes('grid-column: 1 / -1;'),
        'The Draw Next Card control should span the full mobile cockpit width');
}

console.log('All live deck cockpit CSS checks passed!');
