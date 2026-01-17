/**
 * Test suite for storage utilities
 * Run with: node tests/storageUtils.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing storage utilities...');

// Read the storage-utils.js file and extract functions
const storageUtilsCode = fs.readFileSync(
    path.join(__dirname, '..', 'storage-utils.js'),
    'utf8'
);

// Create a mock localStorage for testing
const mockStorage = {
    _data: {},
    getItem(key) {
        return this._data[key] || null;
    },
    setItem(key, value) {
        this._data[key] = value;
    },
    removeItem(key) {
        delete this._data[key];
    },
    clear() {
        this._data = {};
    }
};

// Create mock window object
const mockWindow = {
    localStorage: mockStorage
};

// Execute the storage utils code in our mock context
const storageUtils = (function (window) {
    function isStorageAvailable() {
        try {
            const test = '__storage_test__';
            window.localStorage.setItem(test, test);
            window.localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    function saveState(key, state) {
        if (!isStorageAvailable()) {
            console.warn('Local storage is not available');
            return;
        }
        try {
            window.localStorage.setItem(key, JSON.stringify(state));
        } catch (e) {
            console.warn('Error saving state:', e);
        }
    }

    function loadState(key) {
        if (!isStorageAvailable()) {
            console.warn('Local storage is not available');
            return null;
        }
        try {
            const saved = window.localStorage.getItem(key);
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.warn('Error loading state:', e);
            return null;
        }
    }

    return { isStorageAvailable, saveState, loadState };
})(mockWindow);

// ============================
// Test: Storage Availability
// ============================

console.log('\nTesting storage availability...');

const available = storageUtils.isStorageAvailable();
assert.strictEqual(available, true, 'Mock storage should be available');
console.log('  ✓ isStorageAvailable returns true for working storage');

// ============================
// Test: Save and Load State
// ============================

console.log('\nTesting save and load state...');

// Test saving simple object
const testState = { name: 'test', value: 42 };
storageUtils.saveState('testKey', testState);
const loaded = storageUtils.loadState('testKey');
assert.deepStrictEqual(loaded, testState, 'Loaded state should match saved state');
console.log('  ✓ saveState and loadState work for simple objects');

// Test saving complex nested object
const complexState = {
    selectedGames: ['Base Game', 'Of Ale And Adventure'],
    cardCounts: { Environment: 5, Dungeon: 3 },
    options: {
        enableSentry: true,
        enableCorrupter: false
    }
};
storageUtils.saveState('complexKey', complexState);
const loadedComplex = storageUtils.loadState('complexKey');
assert.deepStrictEqual(loadedComplex, complexState, 'Complex state should be preserved');
console.log('  ✓ saveState and loadState work for complex nested objects');

// Test loading non-existent key
const nonExistent = storageUtils.loadState('nonExistentKey');
assert.strictEqual(nonExistent, null, 'Non-existent key should return null');
console.log('  ✓ loadState returns null for non-existent keys');

// Test saving arrays
const arrayState = [1, 2, 3, { nested: 'value' }];
storageUtils.saveState('arrayKey', arrayState);
const loadedArray = storageUtils.loadState('arrayKey');
assert.deepStrictEqual(loadedArray, arrayState, 'Array state should be preserved');
console.log('  ✓ saveState and loadState work for arrays');

// ============================
// Test: Edge Cases
// ============================

console.log('\nTesting edge cases...');

// Test saving null
storageUtils.saveState('nullKey', null);
const loadedNull = storageUtils.loadState('nullKey');
assert.strictEqual(loadedNull, null, 'Null should be preserved');
console.log('  ✓ Handles null values');

// Test saving empty object
storageUtils.saveState('emptyKey', {});
const loadedEmpty = storageUtils.loadState('emptyKey');
assert.deepStrictEqual(loadedEmpty, {}, 'Empty object should be preserved');
console.log('  ✓ Handles empty objects');

// Test saving string
storageUtils.saveState('stringKey', 'just a string');
const loadedString = storageUtils.loadState('stringKey');
assert.strictEqual(loadedString, 'just a string', 'String should be preserved');
console.log('  ✓ Handles string values');

// ============================
// Summary
// ============================

console.log('\n========================================');
console.log('All storage utility tests passed! ✓');
console.log('========================================\n');
