/**
 * Test suite for campaign tracker persistence wiring
 * Run with: node tests/campaignPersistence.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing campaign persistence wiring...');

const dungeonsHtml = fs.readFileSync(path.join(__dirname, '..', 'dungeons_of_enveron.html'), 'utf8');

assert(
    dungeonsHtml.includes("document.querySelectorAll('.checkbox').forEach(checkbox =>"),
    'Dungeons tracker should attach save listeners to all campaign checkboxes'
);
assert(
    dungeonsHtml.includes("checkboxes: Array.from(document.querySelectorAll('.checkbox')).map"),
    'Dungeons tracker should save every campaign checkbox, not only reward checkboxes'
);
assert(
    dungeonsHtml.includes("document.querySelectorAll('.checkbox').forEach((cb, i) =>"),
    'Dungeons tracker should restore every campaign checkbox'
);
assert(
    !dungeonsHtml.includes("reward-item:not(:has(.checkbox-group)) .checkbox"),
    'Dungeons tracker should not use a reward-only selector for campaign checkbox persistence'
);

console.log('All campaign persistence wiring tests passed!');
