/**
 * Test suite for update-utils formatting helpers
 * Run with: node tests/updateUtils.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadUpdateHelpers() {
    const file = path.join(__dirname, '..', 'update-utils.js');
    const code = fs.readFileSync(file, 'utf8');
    const compareMatch = code.match(/export function compareVersions[\s\S]*?\n\}/);
    const messageMatch = code.match(/export function getUpdateNotificationMessage[\s\S]*?\n\}/);
    const markupMatch = code.match(/export function buildUpdateModalMarkup[\s\S]*?\n\}/);

    if (!compareMatch || !messageMatch || !markupMatch) {
        throw new Error('Failed to load update-utils helper functions');
    }

    return new Function(
        compareMatch[0].replace('export ', '') + '\n' +
        messageMatch[0].replace('export ', '') + '\n' +
        markupMatch[0].replace('export ', '') + '\n' +
        'return { compareVersions, getUpdateNotificationMessage, buildUpdateModalMarkup };'
    )();
}

console.log('Testing update-utils helpers...');

const {
    compareVersions,
    getUpdateNotificationMessage,
    buildUpdateModalMarkup
} = loadUpdateHelpers();

assert(compareVersions('2.15.1', '2.15.0') > 0, 'compareVersions should detect newer patch versions');
assert(compareVersions('2.15.0', '2.15.0') === 0, 'compareVersions should treat equal versions as equal');
assert(compareVersions('2.15.0', '2.16.0') < 0, 'compareVersions should detect older versions');

assert.strictEqual(
    getUpdateNotificationMessage('2.15.1'),
    'A new version (2.15.1) of the app is available.'
);
assert.strictEqual(
    getUpdateNotificationMessage(),
    'A new version of the app is available.'
);

const versionedMarkup = buildUpdateModalMarkup('2.15.1');
assert(versionedMarkup.includes('A new version (2.15.1) of the app is available.'),
    'Modal markup should include the provided version');
assert(!versionedMarkup.includes('undefined'),
    'Modal markup should never render the string "undefined"');

const genericMarkup = buildUpdateModalMarkup();
assert(genericMarkup.includes('A new version of the app is available.'),
    'Modal markup should remain valid without a version');
assert(!genericMarkup.includes('undefined'),
    'Generic modal markup should not contain undefined placeholders');

console.log('All update-utils helper tests passed!');
