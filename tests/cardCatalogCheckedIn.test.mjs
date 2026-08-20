import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assessCheckedInCardCatalog } from '../scripts/validate-card-data.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

console.log('Testing checked-in Card Catalog integration...');

const result = await assessCheckedInCardCatalog(repoRoot);

assert.deepEqual(result.errors, []);
assert.equal(result.cardCount, 142);
assert.equal(result.gameCount, 7);
assert.equal(result.decision.checkedIn.accepted, true);

console.log('All checked-in Card Catalog integration tests passed!');
