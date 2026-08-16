/**
 * Card Catalog acquisition tests
 * Run with: node tests/cardCatalog.test.js
 */
const assert = require('assert');
const { loadSourceModule } = require('./helpers/load-source-module');

const REQUIRED_GAME_NAMES = [
    'Base Game',
    'Of Ale And Adventure',
    'Beyond The Vaults',
    'Revenant Retribution',
    'Beasts Of Environ',
    "Oblivion's Maw",
    'Forbidden Creed'
];

function loadAcquisition(overrides = {}) {
    return loadSourceModule('card-catalog.js', {
        dependencies: {
            loadFreshCardCatalog: overrides.loadFreshCardCatalog || (() => Promise.resolve({})),
            loadCardCatalogSnapshot: overrides.loadCardCatalogSnapshot || (() => null),
            loadLegacyCardCatalogSnapshot: overrides.loadLegacyCardCatalogSnapshot || (() => null),
            saveCardCatalogSnapshot: overrides.saveCardCatalogSnapshot || (() => true),
            mergeCardCatalogs: overrides.mergeCardCatalogs || (() => ({ games: {} })),
            normalizeCachedCardCatalog: overrides.normalizeCachedCardCatalog || (value => value),
            REQUIRED_RICH_GAME_SOURCES: Object.fromEntries(
                REQUIRED_GAME_NAMES.map(gameName => [gameName, `${gameName}.json`])
            )
        },
        exports: ['acquireCardCatalog']
    }).acquireCardCatalog;
}

function loadFreshSource(fetch) {
    return loadSourceModule('card-catalog-source.js', {
        dependencies: { fetch },
        exports: ['loadFreshCardCatalog']
    }).loadFreshCardCatalog;
}

function catalogWithCards(cards = [{ id: 1, card: 'Alarm' }]) {
    const normalizedCards = cards.map(card => ({
        type: 'Environment',
        game: 'Base Game',
        sourceImage: 'Alarm.png',
        contents: 'Alarm.png',
        ...card
    }));
    const games = Object.fromEntries(REQUIRED_GAME_NAMES.map((gameName, index) => [
        gameName,
        gameName === 'Base Game'
            ? normalizedCards
            : [{
                id: 1000 + index,
                card: `${gameName} Card`,
                type: 'Environment',
                game: gameName,
                sourceImage: `${index}.png`,
                contents: `${index}.png`,
                renderMode: 'image'
            }]
    ]));

    return {
        sentryTypes: ['Revenant'],
        corrupterTypes: ['Corrupter'],
        heldBackCardTypes: ['Novice'],
        games,
        icons: { grave: { path: 'assets/icons/grave.svg' } },
        cardManifest: { games: Object.fromEntries(REQUIRED_GAME_NAMES.map(name => [name, `${name}.json`])) }
    };
}

function completeFreshResult(catalog) {
    const difficultiesPayload = { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] };
    const manifest = { games: Object.fromEntries(REQUIRED_GAME_NAMES.map(name => [name, `${name}.json`])) };
    const richGames = Object.fromEntries(
        REQUIRED_GAME_NAMES.map(gameName => [
            gameName,
            { cards: catalog.games[gameName].map(card => ({ ...card })) }
        ])
    );
    const gameSources = Object.fromEntries(
        Object.entries(richGames).map(([gameName, value]) => [
            gameName,
            { status: 'success', path: `${gameName}.json`, value }
        ])
    );

    return {
        legacyCatalog: { games: catalog.games },
        difficultiesPayload,
        richCatalog: { manifest, icons: catalog.icons, games: richGames },
        sources: {
            legacy: { status: 'success', value: { games: catalog.games } },
            difficulties: { status: 'success', value: difficultiesPayload },
            manifest: { status: 'success', value: manifest },
            icons: { status: 'success', value: catalog.icons },
            games: gameSources
        },
        allSourcesFetched: true,
        diagnostics: []
    };
}

console.log('Testing Card Catalog acquisition...');

(async () => {
{
    const sourcePayloads = {
        'maladumcards.json': { games: { 'Base Game': [{ id: 1 }] } },
        'difficulties.json': { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
        'data/cards/manifest.json': {
            games: {
                'Base Game': 'data/cards/base-game.json',
                'Forbidden Creed': 'data/cards/forbidden-creed.json'
            }
        },
        'data/cards/icons.json': { grave: { asset: 'assets/icons/grave.svg' } },
        'data/cards/forbidden-creed.json': { cards: [{ id: 2, card: 'Ambush' }] }
    };
    const baseGameError = new Error('base game asset failed');
    const requested = [];
    const loadFreshCardCatalog = loadFreshSource(async (path, options) => {
        requested.push({ path, options });
        if (path === 'data/cards/base-game.json') throw baseGameError;
        if (!(path in sourcePayloads)) {
            return { ok: false, status: 404, json: async () => null };
        }
        return { ok: true, status: 200, json: async () => sourcePayloads[path] };
    });

    const result = await loadFreshCardCatalog({ forceRefresh: true });

    assert.strictEqual(result.allSourcesFetched, false);
    assert.strictEqual(result.sources.legacy.status, 'success');
    assert.strictEqual(result.sources.difficulties.status, 'success');
    assert.strictEqual(result.sources.manifest.status, 'success');
    assert.strictEqual(result.sources.icons.status, 'success');
    assert.strictEqual(result.sources.games['Base Game'].status, 'failure');
    assert.strictEqual(result.sources.games['Base Game'].error, baseGameError);
    assert.strictEqual(result.sources.games['Forbidden Creed'].status, 'success');
    assert.deepStrictEqual(result.richCatalog.games['Forbidden Creed'], sourcePayloads['data/cards/forbidden-creed.json']);
    assert(requested.some(request => request.path === 'data/cards/base-game.json'));
    assert(requested.some(request => request.path === 'data/cards/forbidden-creed.json'));
    assert(requested.every(request => request.options?.cache === 'reload'),
        'A forced reacquisition must bypass the browser and service-worker cache for every source');
}

{
    const catalog = catalogWithCards();
    const cached = [];
    const acquireCardCatalog = loadAcquisition({
        loadFreshCardCatalog: async () => ({
            legacyCatalog: { games: {} },
            difficultiesPayload: { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
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
    assert.deepStrictEqual(result.difficulties, [{ name: 'Novice', novice: 1, veteran: 0 }]);
    assert.strictEqual(result.cardIndex.get(1), catalog.games['Base Game'][0]);
    assert.deepStrictEqual(cached, [[catalog, { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] }]],
        'Fresh acquisition should cache one complete snapshot payload');
}

{
    const catalog = catalogWithCards();
    const structuredError = new Error('structured catalog unavailable');
    const acquireCardCatalog = loadAcquisition({
        loadFreshCardCatalog: async () => ({
            legacyCatalog: { games: {} },
            difficultiesPayload: { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
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
    const richerCachedCatalog = catalogWithCards([
        { id: 1, card: 'Cached Alarm', renderMode: 'rich' },
        { id: 2, card: 'Cached Ambush', renderMode: 'rich' }
    ]);
    const partialSessionCatalog = catalogWithCards([
        { id: 1, card: 'Legacy Alarm', renderMode: 'image' },
        { id: 2, card: 'Fresh Ambush', renderMode: 'rich' }
    ]);
    const failedGame = new Error('base game rich asset unavailable');
    const cachedWrites = [];
    const acquireCardCatalog = loadAcquisition({
        loadFreshCardCatalog: async () => ({
            legacyCatalog: { games: { 'Base Game': [{ id: 1 }, { id: 2 }] } },
            difficultiesPayload: { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
            richCatalog: { games: { 'Base Game': [{ id: 2 }] } },
            allSourcesFetched: false,
            diagnostics: [{ level: 'warn', message: 'Rich source failed:', error: failedGame }]
        }),
        loadCardCatalogSnapshot: () => ({
            catalog: richerCachedCatalog,
            difficulties: { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
            migrated: false
        }),
        mergeCardCatalogs: () => partialSessionCatalog,
        normalizeCachedCardCatalog: value => value,
        saveCardCatalogSnapshot: (...args) => {
            cachedWrites.push(args);
            return true;
        }
    });

    const result = await acquireCardCatalog();

    assert.strictEqual(result.status, 'offline');
    assert.strictEqual(result.catalog, richerCachedCatalog,
        'A richer last-known-good snapshot should win over a viable partial acquisition');
    assert.deepStrictEqual(cachedWrites, [],
        'A partial acquisition must not replace a richer last-known-good snapshot');
    assert.strictEqual(result.diagnostics[0].error, failedGame);
}

{
    const cachedCatalog = catalogWithCards([{ id: 1, card: 'Cached Alarm', renderMode: 'rich' }]);
    const equalPartialCatalog = catalogWithCards([{ id: 1, card: 'Session Alarm', renderMode: 'rich' }]);
    const acquireCardCatalog = loadAcquisition({
        loadFreshCardCatalog: async () => ({
            legacyCatalog: { games: {} },
            difficultiesPayload: { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
            richCatalog: null,
            allSourcesFetched: false,
            diagnostics: []
        }),
        loadCardCatalogSnapshot: () => ({
            catalog: cachedCatalog,
            difficulties: { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
            migrated: false
        }),
        mergeCardCatalogs: () => equalPartialCatalog,
        normalizeCachedCardCatalog: value => value
    });

    const result = await acquireCardCatalog();

    assert.strictEqual(result.status, 'offline');
    assert.strictEqual(result.catalog, cachedCatalog,
        'A valid last-known-good snapshot should win over any incomplete equal-quality candidate');
}

{
    const richOnlyCatalog = catalogWithCards([{ id: 1, card: 'Rich Alarm', renderMode: 'rich' }]);
    const acquireCardCatalog = loadAcquisition({
        loadFreshCardCatalog: async () => ({
            legacyCatalog: null,
            difficultiesPayload: { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
            richCatalog: { games: {} },
            allSourcesFetched: false,
            diagnostics: []
        }),
        mergeCardCatalogs: legacyCatalog => {
            assert.deepStrictEqual(legacyCatalog, {},
                'A failed legacy source should be normalized before partial rich assembly');
            return richOnlyCatalog;
        }
    });

    const result = await acquireCardCatalog();

    assert.strictEqual(result.status, 'partial');
    assert.strictEqual(result.catalog, richOnlyCatalog);
}

{
    const freshCatalog = catalogWithCards([{ id: 1, card: 'Fresh Alarm', renderMode: 'rich' }]);
    const cachedCatalog = catalogWithCards([{ id: 1, card: 'Cached Alarm', renderMode: 'rich' }]);
    const cachedWrites = [];
    const acquireCardCatalog = loadAcquisition({
        loadFreshCardCatalog: async () => ({
            legacyCatalog: { games: {} },
            difficultiesPayload: {
                difficulties: [{ name: 'Broken', novice: 'many', veteran: 0 }]
            },
            richCatalog: null,
            allSourcesFetched: true,
            diagnostics: []
        }),
        loadCardCatalogSnapshot: () => ({
            catalog: cachedCatalog,
            difficulties: { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
            migrated: false
        }),
        mergeCardCatalogs: () => freshCatalog,
        normalizeCachedCardCatalog: value => value,
        saveCardCatalogSnapshot: (...args) => {
            cachedWrites.push(args);
            return true;
        }
    });

    const result = await acquireCardCatalog();

    assert.strictEqual(result.status, 'offline');
    assert.strictEqual(result.catalog, cachedCatalog,
        'Malformed successful difficulty data should fall back to the last-known-good snapshot');
    assert.deepStrictEqual(result.difficulties, [{ name: 'Novice', novice: 1, veteran: 0 }]);
    assert.deepStrictEqual(cachedWrites, [], 'Malformed difficulty data must never be cached');
}

{
    const emptyCatalog = catalogWithCards();
    emptyCatalog.games = Object.fromEntries(REQUIRED_GAME_NAMES.map(gameName => [gameName, []]));
    const malformedCatalog = catalogWithCards();
    malformedCatalog.games['Base Game'] = [null];
    const duplicateCatalog = catalogWithCards([
        { id: 1001, card: 'Duplicate Of Ale Card', renderMode: 'rich' }
    ]);
    const missingGameCatalog = catalogWithCards();
    delete missingGameCatalog.games['Forbidden Creed'];
    const missingRulesCatalog = catalogWithCards();
    missingRulesCatalog.heldBackCardTypes = [];

    const invalidCatalogs = [
        [emptyCatalog, 'A valid JSON payload with no cards must not expose an empty builder'],
        [malformedCatalog, 'Malformed card records must never replace the cache'],
        [duplicateCatalog, 'Duplicate card IDs must never replace the cache'],
        [missingGameCatalog, 'A snapshot missing an authoritative game must never replace the cache'],
        [missingRulesCatalog, 'Missing required deck-rule data must never replace the cache']
    ];

    for (const [catalog, message] of invalidCatalogs) {
        const cachedWrites = [];
        const acquireCardCatalog = loadAcquisition({
            loadFreshCardCatalog: async () => ({
                legacyCatalog: { games: {} },
                difficultiesPayload: { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
                richCatalog: null,
                allSourcesFetched: true,
                diagnostics: []
            }),
            mergeCardCatalogs: () => catalog,
            saveCardCatalogSnapshot: (...args) => {
                cachedWrites.push(args);
                return true;
            }
        });

        const result = await acquireCardCatalog();

        assert.strictEqual(result.status, 'unavailable', message);
        assert.strictEqual(result.catalog, null, message);
        assert.deepStrictEqual(cachedWrites, [], message);
    }
}

{
    const invalidSourceCases = [
        [
            freshResult => { freshResult.sources.games['Base Game'].value.cards.length = 0; },
            'A valid-empty rich payload must never replace the cache'
        ],
        [
            freshResult => {
                freshResult.legacyCatalog = { games: [] };
                freshResult.sources.legacy.value = freshResult.legacyCatalog;
            },
            'A malformed successful legacy payload must never replace the cache'
        ],
        [
            freshResult => { delete freshResult.sources.manifest.value.games['Forbidden Creed']; },
            'A manifest missing a required game source must never replace the cache'
        ],
        [
            freshResult => { freshResult.sources.icons.value = []; },
            'Malformed icon data must never replace the cache'
        ],
        [
            (freshResult, sessionCatalog) => {
                const duplicate = { ...sessionCatalog.games['Base Game'][0], card: 'Duplicate Alarm' };
                freshResult.sources.games['Base Game'].value.cards.push(duplicate);
            },
            'Duplicate raw rich IDs must be rejected before merge can conceal them'
        ],
        [
            freshResult => {
                const gameName = 'Expansion Preview';
                const path = 'data/cards/expansion-preview.json';
                freshResult.richCatalog.manifest.games[gameName] = path;
                freshResult.richCatalog.games[gameName] = { cards: [] };
                freshResult.sources.games[gameName] = {
                    status: 'success',
                    path,
                    value: freshResult.richCatalog.games[gameName]
                };
            },
            'Every manifest-added rich source must be valid before cache replacement'
        ]
    ];

    for (const [makeInvalid, message] of invalidSourceCases) {
        const sessionCatalog = catalogWithCards();
        const freshResult = completeFreshResult(sessionCatalog);
        makeInvalid(freshResult, sessionCatalog);
        const cachedWrites = [];
        const acquireCardCatalog = loadAcquisition({
            loadFreshCardCatalog: async () => freshResult,
            mergeCardCatalogs: () => sessionCatalog,
            saveCardCatalogSnapshot: (...args) => {
                cachedWrites.push(args);
                return true;
            }
        });

        const result = await acquireCardCatalog();

        assert.strictEqual(result.status, 'partial', message);
        assert.strictEqual(result.catalog, sessionCatalog, message);
        assert.deepStrictEqual(cachedWrites, [], message);
    }
}

{
    const sessionCatalog = catalogWithCards();
    const freshResult = completeFreshResult(sessionCatalog);
    freshResult.sources.games['Base Game'].value.cards[0] = null;
    const acquireCardCatalog = loadAcquisition({
        loadFreshCardCatalog: async () => freshResult,
        mergeCardCatalogs: (_legacyCatalog, richCatalog) => {
            assert.strictEqual(richCatalog.games['Base Game'], undefined,
                'A malformed rich game should be excluded before safe partial assembly');
            return sessionCatalog;
        }
    });

    const result = await acquireCardCatalog();

    assert.strictEqual(result.status, 'partial');
    assert.strictEqual(result.catalog, sessionCatalog);
}

{
    const richerCachedCatalog = catalogWithCards([
        { id: 1, card: 'Cached Alarm', renderMode: 'rich' },
        { id: 2, card: 'Cached Ambush', renderMode: 'rich' }
    ]);
    const lowerQualityFreshCatalog = catalogWithCards([
        { id: 1, card: 'Fresh Alarm', renderMode: 'rich' }
    ]);
    const cachedWrites = [];
    const acquireCardCatalog = loadAcquisition({
        loadFreshCardCatalog: async () => ({
            legacyCatalog: { games: {} },
            difficultiesPayload: { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
            richCatalog: null,
            allSourcesFetched: true,
            diagnostics: []
        }),
        loadCardCatalogSnapshot: () => ({
            catalog: richerCachedCatalog,
            difficulties: { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
            migrated: false
        }),
        mergeCardCatalogs: () => lowerQualityFreshCatalog,
        normalizeCachedCardCatalog: value => value,
        saveCardCatalogSnapshot: (...args) => {
            cachedWrites.push(args);
            return true;
        }
    });

    const result = await acquireCardCatalog();

    assert.strictEqual(result.status, 'offline');
    assert.strictEqual(result.catalog, richerCachedCatalog,
        'The builder should use the richer valid snapshot instead of a lower-quality fresh candidate');
    assert.deepStrictEqual(cachedWrites, [], 'A lower-quality candidate must not replace the snapshot');
}

{
    const catalog = catalogWithCards();
    const cachedDifficulties = {
        difficulties: [
            { name: 'Novice', novice: 1, veteran: 0 },
            { name: 'Veteran', novice: 0, veteran: 1 }
        ]
    };
    const cachedWrites = [];
    const acquireCardCatalog = loadAcquisition({
        loadFreshCardCatalog: async () => ({
            legacyCatalog: { games: {} },
            difficultiesPayload: { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
            richCatalog: null,
            allSourcesFetched: true,
            diagnostics: []
        }),
        loadCardCatalogSnapshot: () => ({ catalog, difficulties: cachedDifficulties, migrated: false }),
        mergeCardCatalogs: () => catalog,
        normalizeCachedCardCatalog: value => value,
        saveCardCatalogSnapshot: (...args) => {
            cachedWrites.push(args);
            return true;
        }
    });

    const result = await acquireCardCatalog();

    assert.strictEqual(result.status, 'offline');
    assert.deepStrictEqual(result.difficulties, cachedDifficulties.difficulties,
        'A fresh candidate must not shrink the saved difficulty set');
    assert.deepStrictEqual(cachedWrites, []);
}

{
    const cachedCatalog = catalogWithCards([{ id: 7, card: 'Cached Alarm', renderMode: 'image' }]);
    const normalizedCatalog = catalogWithCards([{ id: 7, card: 'Cached Alarm', renderMode: 'rich' }]);
    const networkError = new Error('offline');
    const acquireCardCatalog = loadAcquisition({
        loadFreshCardCatalog: async () => { throw networkError; },
        loadCardCatalogSnapshot: () => ({
            catalog: cachedCatalog,
            difficulties: { difficulties: [{ name: 'Veteran', novice: 0, veteran: 1 }] },
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
    assert.deepStrictEqual(result.difficulties, [{ name: 'Veteran', novice: 0, veteran: 1 }]);
    assert.strictEqual(result.diagnostics[0].error, networkError);
}

{
    const malformedCachedCatalog = catalogWithCards();
    delete malformedCachedCatalog.games['Forbidden Creed'];
    const networkError = new Error('offline');
    const acquireCardCatalog = loadAcquisition({
        loadFreshCardCatalog: async () => { throw networkError; },
        loadCardCatalogSnapshot: () => ({
            catalog: malformedCachedCatalog,
            difficulties: { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
            migrated: false
        }),
        normalizeCachedCardCatalog: value => value
    });

    const result = await acquireCardCatalog();

    assert.strictEqual(result.status, 'unavailable',
        'An invalid cached snapshot must not expose an apparently usable builder');
    assert.strictEqual(result.catalog, null);
}

{
    const malformedAtomicCatalog = catalogWithCards();
    delete malformedAtomicCatalog.games['Forbidden Creed'];
    const legacyCatalog = catalogWithCards([{ id: 9, card: 'Legacy Recovery', renderMode: 'image' }]);
    const networkError = new Error('offline');
    const acquireCardCatalog = loadAcquisition({
        loadFreshCardCatalog: async () => { throw networkError; },
        loadCardCatalogSnapshot: () => ({
            catalog: malformedAtomicCatalog,
            difficulties: { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
            migrated: false
        }),
        loadLegacyCardCatalogSnapshot: () => ({
            catalog: legacyCatalog,
            difficulties: { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
            migrated: true
        }),
        normalizeCachedCardCatalog: value => value
    });

    const result = await acquireCardCatalog();

    assert.strictEqual(result.status, 'offline');
    assert.strictEqual(result.catalog, legacyCatalog,
        'A malformed atomic snapshot must not mask a valid legacy recovery snapshot');
    assert.strictEqual(result.cardIndex.get(9), legacyCatalog.games['Base Game'][0]);
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
