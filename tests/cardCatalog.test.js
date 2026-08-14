/**
 * Card Catalog acquisition tests
 * Run with: node tests/cardCatalog.test.js
 */
const assert = require('assert');
const { loadSourceModule } = require('./helpers/load-source-module');

function loadAcquisition(overrides = {}) {
    return loadSourceModule('card-catalog.js', {
        dependencies: {
            loadFreshCardCatalog: overrides.loadFreshCardCatalog || (() => Promise.resolve({})),
            loadCardCatalogSnapshot: overrides.loadCardCatalogSnapshot || (() => null),
            saveCardCatalogSnapshot: overrides.saveCardCatalogSnapshot || (() => true),
            mergeCardCatalogs: overrides.mergeCardCatalogs || (() => ({ games: {} })),
            normalizeCachedCardCatalog: overrides.normalizeCachedCardCatalog || (value => value)
        },
        exports: ['acquireCardCatalog']
    }).acquireCardCatalog;
}

function catalogWithCards(cards = [{ id: 1, card: 'Alarm' }]) {
    return {
        games: {
            'Base Game': cards
        },
        icons: { grave: { path: 'assets/icons/grave.svg' } },
        cardManifest: { games: { 'Base Game': 'data/cards/base-game.json' } }
    };
}

console.log('Testing Card Catalog acquisition...');

(async () => {
{
    const catalog = catalogWithCards();
    const cached = [];
    const acquireCardCatalog = loadAcquisition({
        loadFreshCardCatalog: async () => ({
            legacyCatalog: { games: {} },
            difficultiesPayload: { difficulties: [{ name: 'Novice' }] },
            richCatalog: null,
            diagnostics: []
        }),
        mergeCardCatalogs: () => catalog,
        saveCardCatalogSnapshot: (...args) => {
            cached.push(args);
            return true;
        }
    });

    const result = await acquireCardCatalog();

    assert.strictEqual(result.status, 'fresh');
    assert.strictEqual(result.catalog, catalog);
    assert.deepStrictEqual(result.difficulties, [{ name: 'Novice' }]);
    assert.strictEqual(result.cardIndex.get(1), catalog.games['Base Game'][0]);
    assert.deepStrictEqual(cached, [[catalog, { difficulties: [{ name: 'Novice' }] }]],
        'Fresh acquisition should cache one complete snapshot payload');
}

{
    const catalog = catalogWithCards();
    const structuredError = new Error('structured catalog unavailable');
    const acquireCardCatalog = loadAcquisition({
        loadFreshCardCatalog: async () => ({
            legacyCatalog: { games: {} },
            difficultiesPayload: { difficulties: [] },
            richCatalog: null,
            diagnostics: [{ level: 'warn', message: 'Structured card catalog unavailable, continuing with legacy image cards:', error: structuredError }]
        }),
        mergeCardCatalogs: (legacyCatalog, richCatalog) => {
            assert.strictEqual(richCatalog, null, 'Structured-data failure should retain legacy acquisition');
            return catalog;
        }
    });

    const result = await acquireCardCatalog();

    assert.strictEqual(result.status, 'fresh');
    assert.strictEqual(result.diagnostics[0].error, structuredError);
}

{
    const cachedCatalog = catalogWithCards([{ id: 7, card: 'Cached Alarm', renderMode: 'image' }]);
    const normalizedCatalog = catalogWithCards([{ id: 7, card: 'Cached Alarm', renderMode: 'rich' }]);
    const networkError = new Error('offline');
    const acquireCardCatalog = loadAcquisition({
        loadFreshCardCatalog: async () => { throw networkError; },
        loadCardCatalogSnapshot: () => ({
            catalog: cachedCatalog,
            difficulties: { difficulties: [{ name: 'Veteran' }] },
            migrated: false
        }),
        normalizeCachedCardCatalog: value => {
            assert.strictEqual(value, cachedCatalog);
            return normalizedCatalog;
        }
    });

    const result = await acquireCardCatalog();

    assert.strictEqual(result.status, 'offline');
    assert.strictEqual(result.catalog, normalizedCatalog);
    assert.strictEqual(result.cardIndex.get(7).renderMode, 'rich');
    assert.deepStrictEqual(result.difficulties, [{ name: 'Veteran' }]);
    assert.strictEqual(result.diagnostics[0].error, networkError);
}

{
    const networkError = new Error('offline');
    const acquireCardCatalog = loadAcquisition({
        loadFreshCardCatalog: async () => { throw networkError; },
        loadCardCatalogSnapshot: () => null
    });

    const result = await acquireCardCatalog();

    assert.strictEqual(result.status, 'unavailable');
    assert.strictEqual(result.catalog, null);
    assert.strictEqual(result.cardIndex.size, 0);
    assert.strictEqual(result.diagnostics[1].error, networkError);
}

{
    const stored = {};
    const { saveCardCatalogSnapshot, loadCardCatalogSnapshot } = loadSourceModule('card-catalog-cache.js', {
        dependencies: {
            saveState: (key, value) => {
                stored[key] = value;
                return true;
            },
            loadState: key => stored[key] || null
        },
        exports: ['saveCardCatalogSnapshot', 'loadCardCatalogSnapshot']
    });

    const catalog = catalogWithCards();
    assert.strictEqual(saveCardCatalogSnapshot(catalog, { difficulties: [{ name: 'Novice' }] }), true);
    const snapshot = loadCardCatalogSnapshot();

    assert.strictEqual(stored['cachedCardCatalogSnapshot.v1'].version, 1);
    assert.strictEqual(snapshot.migrated, false);
    assert.strictEqual(snapshot.catalog, catalog);
    assert.deepStrictEqual(snapshot.difficulties, { difficulties: [{ name: 'Novice' }] });
}

{
    const { loadCardCatalogSnapshot } = loadSourceModule('card-catalog-cache.js', {
        dependencies: {
            saveState: () => true,
            loadState: key => ({
                cachedCardsData: catalogWithCards(),
                cachedDifficultiesData: { difficulties: [{ name: 'Novice' }] }
            }[key] || null)
        },
        exports: ['loadCardCatalogSnapshot']
    });

    const snapshot = loadCardCatalogSnapshot();

    assert.strictEqual(snapshot.migrated, true);
    assert.deepStrictEqual(snapshot.difficulties, { difficulties: [{ name: 'Novice' }] });
}

console.log('All Card Catalog acquisition tests passed!');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
