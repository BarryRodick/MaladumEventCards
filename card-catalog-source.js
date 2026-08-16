export const REQUIRED_RICH_GAME_SOURCES = Object.freeze({
    'Base Game': 'data/cards/base-game.json',
    'Of Ale And Adventure': 'data/cards/of-ale-and-adventure.json',
    'Beyond The Vaults': 'data/cards/beyond-the-vaults.json',
    'Revenant Retribution': 'data/cards/revenant-retribution.json',
    'Beasts Of Environ': 'data/cards/beasts-of-environ.json',
    "Oblivion's Maw": 'data/cards/oblivion-s-maw.json',
    'Forbidden Creed': 'data/cards/forbidden-creed.json'
});

async function fetchJson(path, { forceRefresh = false } = {}) {
    const response = await fetch(path, forceRefresh ? { cache: 'reload' } : undefined);
    if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.status}`);
    }
    return response.json();
}

async function acquireJson(path, options) {
    try {
        return {
            status: 'success',
            path,
            value: await fetchJson(path, options)
        };
    } catch (error) {
        return {
            status: 'failure',
            path,
            error
        };
    }
}

function isRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function sourceDiagnostic(label, result) {
    if (result.status === 'success') return null;
    return {
        level: 'warn',
        message: `${label} unavailable:`,
        error: result.error
    };
}

export const loadFreshCardCatalog = async function loadFreshCardCatalog(options) {
    const [legacy, difficulties, manifest, icons] = await Promise.all([
        acquireJson('maladumcards.json', options),
        acquireJson('difficulties.json', options),
        acquireJson('data/cards/manifest.json', options),
        acquireJson('data/cards/icons.json', options)
    ]);

    const manifestGames = isRecord(manifest.value?.games) ? manifest.value.games : {};
    const gameSourceEntries = Object.entries({
        ...REQUIRED_RICH_GAME_SOURCES,
        ...manifestGames
    });
    const gameResults = await Promise.all(
        gameSourceEntries.map(async ([gameName, path]) => [gameName, await acquireJson(path, options)])
    );
    const games = Object.fromEntries(gameResults);
    const successfulGames = Object.fromEntries(
        gameResults
            .filter(([, result]) => result.status === 'success')
            .map(([gameName, result]) => [gameName, result.value])
    );
    const diagnostics = [
        sourceDiagnostic('Legacy card catalog', legacy),
        sourceDiagnostic('Difficulty settings', difficulties),
        sourceDiagnostic('Structured card manifest', manifest),
        sourceDiagnostic('Structured card icons', icons),
        ...gameResults.map(([gameName, result]) => sourceDiagnostic(`Structured card source for ${gameName}`, result))
    ].filter(Boolean);

    return {
        legacyCatalog: legacy.value ?? null,
        difficultiesPayload: difficulties.value ?? null,
        richCatalog: {
            manifest: manifest.value ?? null,
            icons: icons.value ?? null,
            games: successfulGames
        },
        sources: {
            legacy,
            difficulties,
            manifest,
            icons,
            games
        },
        allSourcesFetched: [legacy, difficulties, manifest, icons, ...Object.values(games)]
            .every(result => result.status === 'success'),
        diagnostics
    };
};
