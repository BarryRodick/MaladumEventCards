/**
 * Card Catalog acquisition tests
 * Run with: node tests/cardCatalog.test.js
 */
const assert = require('assert');
const { loadSourceModule } = require('./helpers/load-source-module');

const REQUIRED_GAMES = [
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
            assessCardCatalog: overrides.assessCardCatalog
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

function catalogWithCards({ extraBaseCard = false, renderMode } = {}) {
    const games = Object.fromEntries(REQUIRED_GAMES.map((game, index) => [game, [{
        id: index + 1,
        card: `${game} Card`,
        type: 'Environment',
        game,
        sourceImage: `${index + 1}.png`,
        contents: `${index + 1}.png`,
        ...(renderMode ? { renderMode, extraction: { status: 'verified' } } : {})
    }]]));
    if (extraBaseCard) {
        games['Base Game'].push({
            id: 100,
            card: 'Extra Base Game Card',
            type: 'Environment',
            game: 'Base Game',
            sourceImage: '100.png',
            contents: '100.png',
            ...(renderMode ? { renderMode, extraction: { status: 'verified' } } : {})
        });
    }
    return {
        sentryTypes: ['Revenant'],
        corrupterTypes: ['Corrupter'],
        heldBackCardTypes: ['Novice'],
        games,
        icons: { grave: { asset: 'assets/icons/grave.svg' } },
        cardManifest: { games: Object.fromEntries(REQUIRED_GAMES.map(game => [game, `${game}.json`])) }
    };
}

function savedSnapshot(catalog, migrated = false) {
    return {
        catalog,
        difficulties: { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
        migrated
    };
}

function completeFreshResult(catalog) {
    const difficultiesPayload = { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] };
    const manifest = {
        sentryTypes: catalog.sentryTypes,
        corrupterTypes: catalog.corrupterTypes,
        heldBackCardTypes: catalog.heldBackCardTypes,
        games: catalog.cardManifest.games
    };
    const richGames = Object.fromEntries(Object.entries(catalog.games).map(([game, cards]) => [
        game,
        { cards: cards.map(card => ({
            ...card,
            extraction: { status: 'verified' }
        })) }
    ]));
    return {
        legacyCatalog: catalog,
        difficultiesPayload,
        richCatalog: { manifest, icons: catalog.icons, games: richGames },
        sources: {
            legacy: { status: 'success', value: catalog },
            difficulties: { status: 'success', value: difficultiesPayload },
            manifest: { status: 'success', value: manifest },
            icons: { status: 'success', value: catalog.icons },
            games: Object.fromEntries(Object.entries(richGames).map(([game, value]) => [
                game,
                { status: 'success', path: `${game}.json`, value }
            ]))
        },
        diagnostics: []
    };
}

console.log('Testing Card Catalog acquisition...');

(async () => {
    const { assessCardCatalog } = await import('../card-catalog-policy.mjs');

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
            if (!(path in sourcePayloads)) return { ok: false, status: 404, json: async () => null };
            return { ok: true, status: 200, json: async () => sourcePayloads[path] };
        });

        const result = await loadFreshCardCatalog({ forceRefresh: true });

        assert.strictEqual(result.allSourcesFetched, false);
        assert.strictEqual(result.sources.games['Base Game'].status, 'failure');
        assert.strictEqual(result.sources.games['Forbidden Creed'].status, 'success');
        assert(requested.every(request => request.options?.cache === 'reload'));
    }

    {
        const writes = [];
        const acquireCardCatalog = loadAcquisition({
            loadFreshCardCatalog: async () => completeFreshResult(catalogWithCards()),
            saveCardCatalogSnapshot: (...args) => {
                writes.push(args);
                return true;
            },
            assessCardCatalog
        });

        const result = await acquireCardCatalog();

        assert.strictEqual(result.status, 'fresh');
        assert.strictEqual(result.cardIndex.size, 7);
        assert.strictEqual(writes.length, 1);
        assert.deepStrictEqual(writes[0][1], {
            difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }]
        });
    }

    {
        const fresh = completeFreshResult(catalogWithCards());
        const saved = savedSnapshot(catalogWithCards({ extraBaseCard: true }));
        const acquireCardCatalog = loadAcquisition({
            loadFreshCardCatalog: async () => fresh,
            loadCardCatalogSnapshot: () => saved,
            assessCardCatalog
        });

        const result = await acquireCardCatalog();

        assert.strictEqual(result.status, 'offline');
        assert(result.diagnostics.some(diagnostic => (
            diagnostic.message === 'Fetched Card Catalog was lower quality than the saved snapshot; using saved data.'
        )));
    }

    {
        const fresh = completeFreshResult(catalogWithCards());
        fresh.sources.games['Base Game'] = { status: 'failure', error: new Error('offline') };
        const saved = savedSnapshot(catalogWithCards({ renderMode: 'rich' }));
        const acquireCardCatalog = loadAcquisition({
            loadFreshCardCatalog: async () => fresh,
            loadCardCatalogSnapshot: () => saved,
            assessCardCatalog
        });

        const result = await acquireCardCatalog();

        assert.strictEqual(result.status, 'offline');
        assert(result.diagnostics.some(diagnostic => (
            diagnostic.message === 'Fetched Card Catalog was incomplete; using the last-known-good saved data.'
        )));
    }

    {
        const fresh = completeFreshResult(catalogWithCards());
        fresh.sources.games['Base Game'] = { status: 'failure', error: new Error('offline') };
        const saved = savedSnapshot(catalogWithCards());
        const acquireCardCatalog = loadAcquisition({
            loadFreshCardCatalog: async () => fresh,
            loadCardCatalogSnapshot: () => saved,
            assessCardCatalog
        });

        const result = await acquireCardCatalog();

        assert.strictEqual(result.status, 'partial');
        assert(result.diagnostics.some(diagnostic => (
            diagnostic.message === 'One or more Card Catalog sources were empty or malformed; using a session-only catalog.'
        )));
        assert(result.diagnostics.some(diagnostic => (
            diagnostic.message === 'Using a richer session-only Card Catalog; the last-known-good saved snapshot remains unchanged.'
        )));
    }

    {
        const catalog = catalogWithCards();
        const policyInputs = [];
        const acquireCardCatalog = loadAcquisition({
            loadFreshCardCatalog: async () => completeFreshResult(catalog),
            assessCardCatalog: input => {
                policyInputs.push(input);
                return {
                    outcome: 'use-candidate-session-only',
                    selected: { catalog, difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
                    persistCandidate: false,
                    candidate: { usable: true, sourceComplete: false, persistenceEligible: false },
                    reasons: [{ code: 'source.rich_game_unavailable', values: { game: 'Base Game' } }]
                };
            }
        });

        const result = await acquireCardCatalog();

        assert.strictEqual(result.status, 'partial');
        assert.strictEqual(result.catalog, catalog);
        assert.strictEqual(policyInputs[0].profile, 'runtime');
    }

    {
        const savedCatalog = catalogWithCards();
        const sourceError = new Error('rich source failed');
        const acquireCardCatalog = loadAcquisition({
            loadFreshCardCatalog: async () => ({ diagnostics: [{ level: 'warn', error: sourceError }] }),
            assessCardCatalog: () => ({
                outcome: 'use-saved',
                selected: { catalog: savedCatalog, difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
                persistCandidate: false,
                candidate: { usable: true, sourceComplete: false, persistenceEligible: false },
                reasons: [{ code: 'quality.regression' }]
            })
        });

        const result = await acquireCardCatalog();

        assert.strictEqual(result.status, 'offline');
        assert.strictEqual(result.catalog, savedCatalog);
        assert.strictEqual(result.diagnostics[0].error, sourceError);
    }

    {
        const catalog = catalogWithCards();
        const acquireCardCatalog = loadAcquisition({
            loadFreshCardCatalog: async () => completeFreshResult(catalog),
            saveCardCatalogSnapshot: () => false,
            assessCardCatalog: () => ({
                outcome: 'use-candidate-and-persist',
                selected: { catalog, difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
                persistCandidate: true,
                candidate: { usable: true, sourceComplete: true, persistenceEligible: true },
                reasons: []
            })
        });

        const result = await acquireCardCatalog();

        assert.strictEqual(result.status, 'fresh');
        assert(result.diagnostics.some(diagnostic => (
            diagnostic.message === 'Unable to cache the fetched Card Catalog for offline use.'
        )));
    }

    {
        const malformed = catalogWithCards();
        delete malformed.games['Forbidden Creed'];
        const acquireCardCatalog = loadAcquisition({
            loadFreshCardCatalog: async () => { throw new Error('offline'); },
            loadCardCatalogSnapshot: () => ({
                catalog: malformed,
                difficulties: { difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }] },
                migrated: false
            }),
            assessCardCatalog
        });

        const result = await acquireCardCatalog();

        assert.strictEqual(result.status, 'unavailable');
        assert.strictEqual(result.catalog, null);
    }

    {
        const fresh = completeFreshResult(catalogWithCards());
        delete fresh.legacyCatalog.games['Forbidden Creed'];
        delete fresh.richCatalog.games['Forbidden Creed'];
        delete fresh.sources.games['Forbidden Creed'];
        const acquireCardCatalog = loadAcquisition({
            loadFreshCardCatalog: async () => fresh,
            loadCardCatalogSnapshot: () => savedSnapshot(catalogWithCards()),
            assessCardCatalog
        });

        const result = await acquireCardCatalog();

        assert.strictEqual(result.status, 'offline');
        assert.strictEqual(
            result.diagnostics[0].message,
            'Fresh Card Catalog unavailable or invalid; using saved data:'
        );
    }

    {
        const fresh = completeFreshResult(catalogWithCards());
        delete fresh.legacyCatalog.games['Forbidden Creed'];
        delete fresh.richCatalog.games['Forbidden Creed'];
        delete fresh.sources.games['Forbidden Creed'];
        const acquireCardCatalog = loadAcquisition({
            loadFreshCardCatalog: async () => fresh,
            assessCardCatalog
        });

        const result = await acquireCardCatalog();

        assert.strictEqual(result.status, 'unavailable');
        assert.deepStrictEqual(result.diagnostics.map(diagnostic => diagnostic.message), [
            'Fresh Card Catalog unavailable or invalid; checking saved data:',
            'No valid saved Card Catalog available:'
        ]);
    }

    {
        const malformedAtomic = catalogWithCards();
        delete malformedAtomic.games['Forbidden Creed'];
        const legacy = catalogWithCards();
        legacy.games['Base Game'][0].card = 'Legacy recovery';
        const acquireCardCatalog = loadAcquisition({
            loadFreshCardCatalog: async () => { throw new Error('offline'); },
            loadCardCatalogSnapshot: () => savedSnapshot(malformedAtomic),
            loadLegacyCardCatalogSnapshot: () => savedSnapshot(legacy, true),
            assessCardCatalog
        });

        const result = await acquireCardCatalog();

        assert.strictEqual(result.status, 'offline');
        assert.strictEqual(result.catalog.games['Base Game'][0].card, 'Legacy recovery');
        assert.strictEqual(
            result.diagnostics[0].message,
            'Fresh Card Catalog unavailable or invalid; using saved data:'
        );
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

        assert.strictEqual(snapshot.migrated, false);
        assert.strictEqual(snapshot.catalog, catalog);
        assert.deepStrictEqual(snapshot.difficulties, { difficulties: [{ name: 'Novice' }] });
    }

    console.log('All Card Catalog acquisition tests passed!');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
