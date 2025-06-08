import assert from 'assert';
import { parseCardTypes } from '../card-utils.js';

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
