import { loadFreshCardCatalog } from './card-catalog-source.js';
import { loadCardCatalogSnapshot, saveCardCatalogSnapshot } from './card-catalog-cache.js';
import { mergeCardCatalogs, normalizeCachedCardCatalog } from './card-data.mjs';

function toDifficulties(payload) {
    return Array.isArray(payload?.difficulties) ? payload.difficulties : [];
}

function buildCardIndex(catalog) {
    const cardIndex = new Map();

    Object.values(catalog?.games || {}).forEach(cards => {
        if (!Array.isArray(cards)) return;
        cards.forEach(card => {
            if (card?.id !== undefined && card?.id !== null) {
                cardIndex.set(card.id, card);
            }
        });
    });

    return cardIndex;
}

function readyResult(status, catalog, difficulties, diagnostics = []) {
    return {
        status,
        catalog,
        difficulties,
        cardIndex: buildCardIndex(catalog),
        diagnostics
    };
}

function failureResult(error) {
    return {
        status: 'unavailable',
        catalog: null,
        difficulties: [],
        cardIndex: new Map(),
        diagnostics: [
            {
                level: 'warn',
                message: 'Fetch failed, trying cache:',
                error
            },
            {
                level: 'error',
                message: 'No cached data available:',
                error
            }
        ]
    };
}

export const acquireCardCatalog = async function acquireCardCatalog() {
    try {
        const {
            legacyCatalog,
            difficultiesPayload,
            richCatalog,
            diagnostics = []
        } = await loadFreshCardCatalog();
        const catalog = mergeCardCatalogs(legacyCatalog, richCatalog);
        const difficulties = toDifficulties(difficultiesPayload);
        const didCache = saveCardCatalogSnapshot(catalog, { difficulties });
        const cacheDiagnostics = didCache
            ? []
            : [{
                level: 'warn',
                message: 'Unable to cache fetched game data for offline use.'
            }];

        return readyResult('fresh', catalog, difficulties, [...diagnostics, ...cacheDiagnostics]);
    } catch (error) {
        const cachedSnapshot = loadCardCatalogSnapshot();
        if (!cachedSnapshot) {
            return failureResult(error);
        }

        return readyResult(
            'offline',
            normalizeCachedCardCatalog(cachedSnapshot.catalog),
            toDifficulties(cachedSnapshot.difficulties),
            [{
                level: 'warn',
                message: 'Fetch failed, trying cache:',
                error
            }]
        );
    }
};
