async function fetchJson(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.status}`);
    }
    return response.json();
}

async function loadRichCardCatalog() {
    const manifest = await fetchJson('data/cards/manifest.json');
    const [icons, gameEntries] = await Promise.all([
        fetchJson('data/cards/icons.json'),
        Promise.all(
            Object.entries(manifest.games || {}).map(async ([gameName, path]) => {
                const payload = await fetchJson(path);
                return [gameName, payload];
            })
        )
    ]);

    return {
        manifest,
        icons,
        games: Object.fromEntries(gameEntries)
    };
}

export async function loadFreshCardCatalog() {
    const richCatalogPromise = loadRichCardCatalog()
        .then(richCatalog => ({ richCatalog, diagnostics: [] }))
        .catch(error => ({
            richCatalog: null,
            diagnostics: [{
                level: 'warn',
                message: 'Structured card catalog unavailable, continuing with legacy image cards:',
                error
            }]
        }));

    const [legacyCatalog, difficultiesPayload, richResult] = await Promise.all([
        fetchJson('maladumcards.json'),
        fetchJson('difficulties.json'),
        richCatalogPromise
    ]);

    return {
        legacyCatalog,
        difficultiesPayload,
        richCatalog: richResult.richCatalog,
        diagnostics: richResult.diagnostics
    };
}
