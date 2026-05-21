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
    assert(mobileNavigationBlock.includes('position: sticky;'),
        'Mobile live deck controls should stay sticky at the bottom while scrolling');
    assert(mobileNavigationBlock.includes('order: 3;'),
        'Mobile live deck controls should appear before the large card image in the first viewport');
    assert(mobileNavigationBlock.includes('grid-template-columns: 1fr 1fr;'),
        'Mobile live deck controls should keep secondary controls readable in two columns');
}

{
    assert(styles.includes('.rune-btn.next-draw') && styles.includes('grid-column: 1 / -1;'),
        'The Draw Next Card control should span the full mobile cockpit width');
}

console.log('All live deck cockpit CSS checks passed!');
