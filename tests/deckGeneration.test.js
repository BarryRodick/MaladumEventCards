/**
 * Test suite for deck generation functions
 * Run with: node tests/deckGeneration.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Load card data
const cardsJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maladumcards.json'), 'utf8'));
const difficultiesJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'difficulties.json'), 'utf8'));

// Extract shuffleDeck from card-utils.js
function loadShuffleDeck() {
    const file = path.join(__dirname, '..', 'card-utils.js');
    const code = fs.readFileSync(file, 'utf8');
    const match = code.match(/export function shuffleDeck[\s\S]*?\n\}/);
    if (!match) throw new Error('shuffleDeck function not found');
    const fnBody = match[0].replace('export ', '');
    return (new Function(fnBody + '; return shuffleDeck;'))();
}

const shuffleDeck = loadShuffleDeck();

// ============================
// Test: Card Data Integrity
// ============================

console.log('Testing card data integrity...');

// Test that all games have cards
const games = Object.keys(cardsJson.games);
assert(games.length > 0, 'Should have at least one game');
console.log(`  ✓ Found ${games.length} games`);

// Test that all cards have required fields
let totalCards = 0;
for (const game of games) {
    const cards = cardsJson.games[game];
    for (const card of cards) {
        assert(card.id !== undefined, `Card missing id in ${game}`);
        assert(card.card !== undefined, `Card missing name in ${game}`);
        assert(card.type !== undefined, `Card missing type in ${game}`);
        assert(card.contents !== undefined, `Card missing contents in ${game}`);
        totalCards++;
    }
}
console.log(`  ✓ All ${totalCards} cards have required fields (id, card, type, contents)`);

// Test card ID uniqueness
const allIds = [];
for (const game of games) {
    for (const card of cardsJson.games[game]) {
        allIds.push(card.id);
    }
}
const uniqueIds = new Set(allIds);
assert.strictEqual(allIds.length, uniqueIds.size, 'All card IDs should be unique');
console.log(`  ✓ All ${allIds.length} card IDs are unique`);

// ============================
// Test: Shuffle Function
// ============================

console.log('\nTesting shuffle function...');

// Test that shuffle returns same length
const testDeck = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const shuffled = shuffleDeck([...testDeck]);
assert.strictEqual(shuffled.length, testDeck.length, 'Shuffled deck should have same length');
console.log('  ✓ Shuffle preserves deck length');

// Test that shuffle contains all original elements
const sortedOriginal = [...testDeck].sort((a, b) => a - b);
const sortedShuffled = [...shuffled].sort((a, b) => a - b);
assert.deepStrictEqual(sortedShuffled, sortedOriginal, 'Shuffled deck should contain all original cards');
console.log('  ✓ Shuffle preserves all elements');

// Test that shuffle actually changes order (statistical - run multiple times)
let orderChanged = false;
for (let i = 0; i < 10; i++) {
    const anotherShuffle = shuffleDeck([...testDeck]);
    if (JSON.stringify(anotherShuffle) !== JSON.stringify(testDeck)) {
        orderChanged = true;
        break;
    }
}
assert(orderChanged, 'Shuffle should change order (run multiple times if this fails)');
console.log('  ✓ Shuffle changes element order');

// ============================
// Test: Difficulty Settings
// ============================

console.log('\nTesting difficulty settings...');

const difficulties = difficultiesJson.difficulties;
assert(Array.isArray(difficulties), 'Difficulties should be an array');
assert(difficulties.length > 0, 'Should have at least one difficulty level');
console.log(`  ✓ Found ${difficulties.length} difficulty levels`);

// Test each difficulty has required fields
for (const diff of difficulties) {
    assert(diff.name !== undefined, 'Difficulty missing name');
    assert(diff.description !== undefined, 'Difficulty missing description');
    assert(diff.cardTypes !== undefined, 'Difficulty missing cardTypes');
}
console.log('  ✓ All difficulty levels have required fields');

// ============================
// Test: Special Card Types
// ============================

console.log('\nTesting special card types...');

assert(Array.isArray(cardsJson.sentryTypes), 'sentryTypes should be an array');
assert(Array.isArray(cardsJson.corrupterTypes), 'corrupterTypes should be an array');
assert(Array.isArray(cardsJson.heldBackCardTypes), 'heldBackCardTypes should be an array');

console.log(`  ✓ Sentry types: ${cardsJson.sentryTypes.join(', ')}`);
console.log(`  ✓ Corrupter types: ${cardsJson.corrupterTypes.join(', ')}`);
console.log(`  ✓ Held back types: ${cardsJson.heldBackCardTypes.join(', ')}`);

// Verify sentry cards exist in the deck
const allCardTypes = new Set();
for (const game of games) {
    for (const card of cardsJson.games[game]) {
        // Handle compound types like "Revenant + Veteran"
        const types = card.type.split(/[+\/]/).map(t => t.trim());
        types.forEach(t => allCardTypes.add(t));
    }
}

for (const sentryType of cardsJson.sentryTypes) {
    assert(allCardTypes.has(sentryType), `Sentry type "${sentryType}" should exist in card data`);
}
console.log('  ✓ All sentry types exist in card data');

// ============================
// Test: Card Type Parsing (Extended)
// ============================

console.log('\nTesting card type parsing...');

// Load parseCardTypes
function loadParseCardTypes() {
    const file = path.join(__dirname, '..', 'card-utils.js');
    const code = fs.readFileSync(file, 'utf8');
    const match = code.match(/export function parseCardTypes[\s\S]*?\n\}/);
    if (!match) throw new Error('parseCardTypes function not found');
    const fnBody = match[0].replace('export ', '');
    return (new Function('const parseCardTypesCache = new Map();\n' + fnBody + '; return parseCardTypes;'))();
}

const parseCardTypes = loadParseCardTypes();

// Test compound types from actual card data
assert.deepStrictEqual(
    parseCardTypes('Revenant + Veteran'),
    { andGroups: [['Revenant'], ['Veteran']], allTypes: ['Revenant', 'Veteran'] }
);
console.log('  ✓ Parses "Revenant + Veteran" correctly');

assert.deepStrictEqual(
    parseCardTypes('Corrupter / Wandering Beast'),
    { andGroups: [['Corrupter', 'Wandering Beast']], allTypes: ['Corrupter', 'Wandering Beast'] }
);
console.log('  ✓ Parses "Corrupter / Wandering Beast" correctly');

assert.deepStrictEqual(
    parseCardTypes('Environment'),
    { andGroups: [['Environment']], allTypes: ['Environment'] }
);
console.log('  ✓ Parses simple type "Environment" correctly');

// ============================
// Summary
// ============================

console.log('\n========================================');
console.log('All deck generation tests passed! ✓');
console.log('========================================\n');
