/**
 * Test suite for storage utilities
 * Run with: node tests/storageUtils.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function loadStorageUtils() {
    const storageUtilsCode = fs.readFileSync(
        path.join(__dirname, '..', 'storage-utils.js'),
        'utf8'
    );
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(storageUtilsCode).toString('base64')}`;
    return import(moduleUrl);
}

(async () => {
    console.log('Testing storage utilities...');

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

    global.window = { localStorage: mockStorage };
    const storageUtils = await loadStorageUtils();

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
    assert.strictEqual(storageUtils.saveState('testKey', testState), true);
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
    assert.strictEqual(storageUtils.saveState('complexKey', complexState), true);
    const loadedComplex = storageUtils.loadState('complexKey');
    assert.deepStrictEqual(loadedComplex, complexState, 'Complex state should be preserved');
    console.log('  ✓ saveState and loadState work for complex nested objects');

    // Test loading non-existent key
    const nonExistent = storageUtils.loadState('nonExistentKey');
    assert.strictEqual(nonExistent, null, 'Non-existent key should return null');
    console.log('  ✓ loadState returns null for non-existent keys');

    // Test saving arrays
    const arrayState = [1, 2, 3, { nested: 'value' }];
    assert.strictEqual(storageUtils.saveState('arrayKey', arrayState), true);
    const loadedArray = storageUtils.loadState('arrayKey');
    assert.deepStrictEqual(loadedArray, arrayState, 'Array state should be preserved');
    console.log('  ✓ saveState and loadState work for arrays');

    // ============================
    // Test: Edge Cases
    // ============================

    console.log('\nTesting edge cases...');

    // Test saving null
    assert.strictEqual(storageUtils.saveState('nullKey', null), true);
    const loadedNull = storageUtils.loadState('nullKey');
    assert.strictEqual(loadedNull, null, 'Null should be preserved');
    console.log('  ✓ Handles null values');

    // Test saving empty object
    assert.strictEqual(storageUtils.saveState('emptyKey', {}), true);
    const loadedEmpty = storageUtils.loadState('emptyKey');
    assert.deepStrictEqual(loadedEmpty, {}, 'Empty object should be preserved');
    console.log('  ✓ Handles empty objects');

    // Test saving string
    assert.strictEqual(storageUtils.saveState('stringKey', 'just a string'), true);
    const loadedString = storageUtils.loadState('stringKey');
    assert.strictEqual(loadedString, 'just a string', 'String should be preserved');
    console.log('  ✓ Handles string values');

    // Test quota exceeded handling from the real implementation
    const originalSetItem = global.window.localStorage.setItem;
    const originalConsoleError = console.error;
    global.window.localStorage.setItem = (key, value) => {
        if (key === '__storage_test__') {
            mockStorage._data[key] = value;
            return;
        }
        const error = new Error('quota exceeded');
        error.name = 'QuotaExceededError';
        throw error;
    };
    console.error = () => { };
    assert.strictEqual(storageUtils.saveState('quotaKey', { blocked: true }), false,
        'saveState should return false when storage quota is exceeded');
    console.error = originalConsoleError;
    global.window.localStorage.setItem = originalSetItem;
    console.log('  ✓ Returns false when storage quota is exceeded');

    console.log('\n========================================');
    console.log('All storage utility tests passed! ✓');
    console.log('========================================\n');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
