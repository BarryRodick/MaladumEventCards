/**
 * Test suite for the constrained CommonJS source-module loader
 * Run with: node tests/loadSourceModule.test.js
 */
const assert = require('assert');
const { loadSourceModule } = require('./helpers/load-source-module');

const fixturePath = 'tests/fixtures/load-source-module.js';

console.log('Testing source module loader...');

{
    const loaded = loadSourceModule(fixturePath, {
        dependencies: {
            evaluateLoad: () => 'first load',
            transformValue: value => `transformed:${value}`
        },
        exports: ['useDependency', 'loadedValue', 'topLevelThis']
    });

    assert.deepStrictEqual(Object.keys(loaded), ['useDependency', 'loadedValue', 'topLevelThis']);
    assert.strictEqual(loaded.useDependency('value'), 'transformed:value');
    assert.strictEqual(loaded.loadedValue, 'first load');
    assert.strictEqual(loaded.topLevelThis, undefined,
        'Transformed ES modules should retain strict top-level this semantics');
}

{
    const loaded = loadSourceModule(fixturePath, {
        dependencies: {
            evaluateLoad: () => 'not returned',
            transformValue: value => value
        },
        exports: ['useDependency']
    });

    assert.deepStrictEqual(Object.keys(loaded), ['useDependency']);
}

{
    const first = loadSourceModule(fixturePath, {
        dependencies: {
            evaluateLoad: () => 'one',
            transformValue: value => `one:${value}`
        },
        exports: ['useDependency', 'loadedValue']
    });
    const second = loadSourceModule(fixturePath, {
        dependencies: {
            evaluateLoad: () => 'two',
            transformValue: value => `two:${value}`
        },
        exports: ['useDependency', 'loadedValue']
    });

    assert.strictEqual(first.useDependency('value'), 'one:value');
    assert.strictEqual(first.loadedValue, 'one');
    assert.strictEqual(second.useDependency('value'), 'two:value');
    assert.strictEqual(second.loadedValue, 'two');
}

assert.throws(
    () => loadSourceModule(fixturePath, { exports: ['missingExport'] }),
    error => error.message.includes(fixturePath) && error.message.includes('missingExport'),
    'Missing-export errors should name the export and source module'
);

assert.throws(
    () => loadSourceModule(fixturePath, {
        dependencies: {
            evaluateLoad: () => { throw new Error('fixture evaluation failed'); },
            transformValue: value => value
        },
        exports: ['loadedValue']
    }),
    error => error.message.includes(fixturePath) && error.message.includes('fixture evaluation failed'),
    'Evaluation errors should identify their source module'
);

const unsupportedPath = 'tests/fixtures/load-source-module-unsupported.js';
assert.throws(
    () => loadSourceModule(unsupportedPath, { exports: [] }),
    error => error.message.includes(unsupportedPath) && error.message.includes('Unsupported module syntax'),
    'Unsupported module syntax should fail clearly'
);

console.log('All source module loader tests passed!');
