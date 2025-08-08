const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadParseCardTypes() {
  const file = path.join(__dirname, '..', 'card-utils.js');
  const code = fs.readFileSync(file, 'utf8');
  const match = code.match(/export function parseCardTypes[\s\S]*?\n\}/);
  if (!match) throw new Error('parseCardTypes function not found');
  const fnBody = match[0].replace('export ', '');
  return (new Function('const parseCardTypesCache = new Map();\n' + fnBody + '; return parseCardTypes;'))();
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

assert.deepStrictEqual(
  parseCardTypes(''),
  {
    andGroups: [['']],
    allTypes: ['']
  }
);

assert.deepStrictEqual(
  parseCardTypes('A//B'),
  {
    andGroups: [['A', '', 'B']],
    allTypes: ['A', '', 'B']
  }
);

console.log('All tests passed.');
