import { loadFreshCardCatalog, REQUIRED_RICH_GAME_SOURCES } from './card-catalog-source.js';
import { loadCardCatalogSnapshot, saveCardCatalogSnapshot } from './card-catalog-cache.js';
import { mergeCardCatalogs, normalizeCachedCardCatalog } from './card-data.mjs';

const REQUIRED_GAME_NAMES = Object.keys(REQUIRED_RICH_GAME_SOURCES);

function toDifficulties(payload) {
    return Array.isArray(payload?.difficulties) ? payload.difficulties : [];
}

function hasValidDifficulties(payload) {
    const difficulties = toDifficulties(payload);
    return difficulties.length > 0 && difficulties.every(difficulty => (
        difficulty
        && typeof difficulty === 'object'
        && !Array.isArray(difficulty)
        && typeof difficulty.name === 'string'
        && difficulty.name.trim().length > 0
        && Number.isInteger(difficulty.novice)
        && difficulty.novice >= 0
        && Number.isInteger(difficulty.veteran)
        && difficulty.veteran >= 0
    ));
}

function hasValidRawCard(card, gameName, requireGame) {
    return card
        && typeof card === 'object'
        && !Array.isArray(card)
        && Number.isInteger(card.id)
        && card.id > 0
        && typeof card.card === 'string'
        && card.card.trim().length > 0
        && typeof card.type === 'string'
        && card.type.trim().length > 0
        && (!requireGame || card.game === gameName)
        && [card.sourceImage, card.contents].some(value => typeof value === 'string' && value.trim().length > 0);
}

function hasUniqueCardIds(cards) {
    const ids = cards.map(card => card.id);
    return new Set(ids).size === ids.length;
}

function richGameCards(source) {
    return Array.isArray(source?.value) ? source.value : source?.value?.cards;
}

function hasValidRichGameSource(source, gameName) {
    const cards = richGameCards(source);
    return source?.status === 'success'
        && Array.isArray(cards)
        && cards.length > 0
        && cards.every(card => hasValidRawCard(card, gameName, true))
        && hasUniqueCardIds(cards);
}

function hasValidRichSourcePayloads(sources) {
    if (!sources) return true;
    const cards = [];
    const hasRequiredSources = REQUIRED_GAME_NAMES.every(gameName => {
        const source = sources.games?.[gameName];
        const gameCards = richGameCards(source);
        if (!hasValidRichGameSource(source, gameName)) return false;
        cards.push(...gameCards);
        return true;
    });
    return hasRequiredSources && hasUniqueCardIds(cards);
}

function hasValidLegacySourcePayload(sources) {
    if (!sources) return true;
    const source = sources.legacy;
    const games = source?.value?.games;
    return source?.status === 'success'
        && games
        && typeof games === 'object'
        && !Array.isArray(games)
        && REQUIRED_GAME_NAMES.every(gameName => (
            Array.isArray(games[gameName])
            && games[gameName].length > 0
            && games[gameName].every(card => hasValidRawCard(card, gameName, false))
        ))
        && hasUniqueCardIds(REQUIRED_GAME_NAMES.flatMap(gameName => games[gameName]));
}

function hasValidManifestSourcePayload(sources) {
    if (!sources) return true;
    const source = sources.manifest;
    const games = source?.value?.games;
    return source?.status === 'success'
        && games
        && typeof games === 'object'
        && !Array.isArray(games)
        && REQUIRED_GAME_NAMES.every(gameName => (
            typeof games[gameName] === 'string' && games[gameName].trim().length > 0
        ));
}

function hasValidIconSourcePayload(sources) {
    if (!sources) return true;
    const source = sources.icons;
    const icons = source?.value;
    return source?.status === 'success'
        && icons
        && typeof icons === 'object'
        && !Array.isArray(icons)
        && Object.keys(icons).length > 0
        && Object.values(icons).every(icon => (
            icon
            && typeof icon === 'object'
            && !Array.isArray(icon)
            && [icon.asset, icon.path].some(value => typeof value === 'string' && value.trim().length > 0)
        ));
}

function usableRichCatalog(richCatalog, sources) {
    if (!richCatalog || !sources) return richCatalog;
    const games = Object.fromEntries(
        Object.entries(richCatalog.games || {})
            .filter(([gameName]) => hasValidRichGameSource(sources.games?.[gameName], gameName))
    );
    return {
        ...richCatalog,
        manifest: hasValidManifestSourcePayload(sources) ? richCatalog.manifest : null,
        icons: hasValidIconSourcePayload(sources) ? richCatalog.icons : {},
        games
    };
}

function isValidCatalog(catalog) {
    const requiredRuleCollections = ['sentryTypes', 'corrupterTypes', 'heldBackCardTypes'];
    if (
        !catalog
        || typeof catalog !== 'object'
        || Array.isArray(catalog)
        || !catalog.games
        || typeof catalog.games !== 'object'
        || Array.isArray(catalog.games)
        || !requiredRuleCollections.every(name => (
            Array.isArray(catalog[name])
            && catalog[name].length > 0
            && catalog[name].every(value => typeof value === 'string' && value.trim().length > 0)
        ))
    ) {
        return false;
    }

    const gameEntries = Object.entries(catalog.games);
    const hasEveryRequiredGame = REQUIRED_GAME_NAMES.every(gameName => (
        Array.isArray(catalog.games[gameName]) && catalog.games[gameName].length > 0
    ));
    const hasValidCards = hasEveryRequiredGame
        && gameEntries.every(([gameName, cards]) => (
            Array.isArray(cards)
            && cards.every(card => hasValidRawCard(card, gameName, true))
        ));
    if (!hasValidCards) return false;

    return hasUniqueCardIds(gameEntries.flatMap(([, cards]) => cards));
}

function measureCatalogQuality(catalog, difficulties) {
    const cards = Object.values(catalog.games).flat();
    return {
        cardCount: cards.length,
        richCardCount: cards.filter(card => card.renderMode === 'rich').length,
        iconCount: Object.keys(catalog.icons || {}).length,
        manifestGameCount: Object.keys(catalog.cardManifest?.games || {}).length,
        ruleTypeCount: ['sentryTypes', 'corrupterTypes', 'heldBackCardTypes']
            .reduce((count, name) => count + catalog[name].length, 0),
        difficultyCount: difficulties.length
    };
}

function isAtLeastAsRich(candidateCatalog, candidateDifficulties, cachedCatalog, cachedDifficulties) {
    const candidateQuality = measureCatalogQuality(candidateCatalog, candidateDifficulties);
    const cachedQuality = measureCatalogQuality(cachedCatalog, cachedDifficulties);
    return Object.keys(candidateQuality).every(name => candidateQuality[name] >= cachedQuality[name]);
}

function loadValidCachedSnapshot() {
    const snapshot = loadCardCatalogSnapshot();
    if (!snapshot || !hasValidDifficulties(snapshot.difficulties)) return null;

    const catalog = normalizeCachedCardCatalog(snapshot.catalog);
    if (!isValidCatalog(catalog)) return null;

    return {
        ...snapshot,
        catalog,
        difficulties: toDifficulties(snapshot.difficulties)
    };
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
                message: 'Fresh Card Catalog unavailable or invalid; checking saved data:',
                error
            },
            {
                level: 'error',
                message: 'No valid saved Card Catalog available:',
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
            sources,
            complete = true,
            diagnostics = []
        } = await loadFreshCardCatalog();
        if (!hasValidDifficulties(difficultiesPayload)) {
            throw new Error('Fresh difficulty settings are empty or malformed.');
        }
        const legacySourceValid = hasValidLegacySourcePayload(sources);
        const catalog = mergeCardCatalogs(
            legacySourceValid ? (legacyCatalog || {}) : {},
            usableRichCatalog(richCatalog, sources)
        );
        if (!isValidCatalog(catalog)) {
            throw new Error('Fresh Card Catalog is empty or malformed.');
        }
        const difficulties = toDifficulties(difficultiesPayload);
        const sourcePayloadsValid = hasValidRichSourcePayloads(sources)
            && legacySourceValid
            && hasValidManifestSourcePayload(sources)
            && hasValidIconSourcePayload(sources);
        const candidateDiagnostics = sourcePayloadsValid
            ? diagnostics
            : [
                ...diagnostics,
                {
                    level: 'warn',
                    message: 'One or more Card Catalog sources were empty or malformed; using a session-only catalog.'
                }
            ];
        const cacheEligible = complete && sourcePayloadsValid;
        const cachedSnapshot = loadValidCachedSnapshot();
        if (cachedSnapshot) {
            const candidateIsAtLeastAsRich = isAtLeastAsRich(
                catalog,
                difficulties,
                cachedSnapshot.catalog,
                cachedSnapshot.difficulties
            );
            if (!cacheEligible || !candidateIsAtLeastAsRich) {
                return readyResult(
                    'offline',
                    cachedSnapshot.catalog,
                    cachedSnapshot.difficulties,
                    [
                        ...candidateDiagnostics,
                        {
                            level: 'warn',
                            message: cacheEligible
                                ? 'Fetched Card Catalog was lower quality than the saved snapshot; using saved data.'
                                : 'Fetched Card Catalog was incomplete; using the last-known-good saved data.'
                        }
                    ]
                );
            }
        }
        const didCache = cacheEligible ? saveCardCatalogSnapshot(catalog, { difficulties }) : null;
        const cacheDiagnostics = didCache === false
            ? [{
                level: 'warn',
                message: 'Unable to cache fetched game data for offline use.'
            }]
            : [];

        return readyResult(
            cacheEligible ? 'fresh' : 'partial',
            catalog,
            difficulties,
            [...candidateDiagnostics, ...cacheDiagnostics]
        );
    } catch (error) {
        const cachedSnapshot = loadValidCachedSnapshot();
        if (!cachedSnapshot) {
            return failureResult(error);
        }

        return readyResult(
            'offline',
            cachedSnapshot.catalog,
            cachedSnapshot.difficulties,
            [{
                level: 'warn',
                message: 'Fresh Card Catalog unavailable or invalid; using saved data:',
                error
            }]
        );
    }
};
