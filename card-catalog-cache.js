import { loadState, saveState } from './storage-utils.js';

const SNAPSHOT_KEY = 'cachedCardCatalogSnapshot.v1';
const LEGACY_CACHE_KEYS = {
    catalog: 'cachedCardsData',
    difficulties: 'cachedDifficultiesData'
};

function isRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

export function saveCardCatalogSnapshot(catalog, difficulties) {
    return saveState(SNAPSHOT_KEY, {
        version: 1,
        catalog,
        difficulties
    });
}

export function loadCardCatalogSnapshot() {
    const snapshot = loadState(SNAPSHOT_KEY);
    if (isRecord(snapshot) && snapshot.version === 1 && isRecord(snapshot.catalog) && isRecord(snapshot.difficulties)) {
        return {
            catalog: snapshot.catalog,
            difficulties: snapshot.difficulties,
            migrated: false
        };
    }

    const catalog = loadState(LEGACY_CACHE_KEYS.catalog);
    const difficulties = loadState(LEGACY_CACHE_KEYS.difficulties);
    if (!isRecord(catalog) || !isRecord(difficulties)) {
        return null;
    }

    return {
        catalog,
        difficulties,
        migrated: true
    };
}
