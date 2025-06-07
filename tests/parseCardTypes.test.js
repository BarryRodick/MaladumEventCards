const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadParseCardTypes() {
  const file = path.join(__dirname, '..', 'deckbuilder.js');
  const code = fs.readFileSync(file, 'utf8');
  const match = code.match(/function parseCardTypes[\s\S]*?\n\}/);
  if (!match) throw new Error('parseCardTypes function not found');
  // Evaluate in current context so Array prototypes match
  return (new Function(match[0] + '; return parseCardTypes;'))();
}

const parseCardTypes = loadParseCardTypes();

assert.deepStrictEqual(
  parseCardTypes('A/B+C'),
  {
    andGroups: [['A', 'B'], ['C']],
    allTypes: ['A', 'B', 'C']
  }
);

assert.deepStrictEqual(
  parseCardTypes('Revenant/Malagaunt'),
  {
    andGroups: [['Revenant', 'Malagaunt']],
    allTypes: ['Revenant', 'Malagaunt']
  }
);

console.log('All tests passed.');
