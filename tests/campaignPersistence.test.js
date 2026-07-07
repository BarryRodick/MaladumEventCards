/**
 * Test suite for campaign tracker persistence wiring
 * Run with: node tests/campaignPersistence.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing campaign persistence wiring...');

const dungeonsHtml = fs.readFileSync(path.join(__dirname, '..', 'dungeons_of_enveron.html'), 'utf8');
const forbiddenHtml = fs.readFileSync(path.join(__dirname, '..', 'forbidden_creed.html'), 'utf8');

assert(
    dungeonsHtml.includes("import { initializeCampaignTracker } from './campaign-tracker.js';"),
    'Dungeons tracker should use the shared campaign tracker module'
);
assert(
    dungeonsHtml.includes("storageKey: 'dungeonState'"),
    'Dungeons tracker should keep the existing storage key'
);
assert(
    dungeonsHtml.includes("checkboxGroupSelector: '.checkbox-group'"),
    'Dungeons tracker should preserve grouped checkbox persistence'
);
assert(
    dungeonsHtml.includes("legacyCheckboxSelector: '.reward-item'"),
    'Dungeons tracker should preserve legacy reward-only restore'
);
assert(
    forbiddenHtml.includes("import { initializeCampaignTracker } from './campaign-tracker.js';"),
    'Forbidden Creed tracker should use the shared campaign tracker module'
);
assert(
    forbiddenHtml.includes("storageKey: 'forbiddenCreedState'"),
    'Forbidden Creed tracker should keep the existing storage key'
);
assert(
    forbiddenHtml.includes("checkboxMode: 'dataset'"),
    'Forbidden Creed tracker should preserve dataset-backed checkbox state'
);

console.log('All campaign persistence wiring tests passed!');
