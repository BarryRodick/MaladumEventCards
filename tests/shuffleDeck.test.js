const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadShuffleDeck() {
  const file = path.join(__dirname, '..', 'card-utils.js');
  const code = fs.readFileSync(file, 'utf8');
  const match = code.match(/export function shuffleDeck[\s\S]*?\n\}/);
  if (!match) throw new Error('shuffleDeck function not found');
  const fnBody = match[0].replace('export ', '');
  return (new Function(fnBody + '; return shuffleDeck;'))();
}

const shuffleDeck = loadShuffleDeck();

const originalDeck = [1, 2, 3, 4, 5];
const mockValues = [0.1, 0.2, 0.3, 0.4, 0.5];
let call = 0;
const originalRandom = Math.random;
Math.random = () => mockValues[call++];

const shuffledDeck = shuffleDeck([...originalDeck]);
Math.random = originalRandom;

assert.strictEqual(shuffledDeck.length, originalDeck.length);
assert.deepStrictEqual([...shuffledDeck].sort(), [...originalDeck].sort());
assert.notDeepStrictEqual(shuffledDeck, originalDeck);

console.log('shuffleDeck tests passed.');
