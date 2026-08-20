import { mergeCardCatalogs, normalizeCachedCardCatalog } from './card-data.mjs';

const PROFILES = new Set(['runtime', 'checked-in']);
const REQUIRED_GAMES = [
    'Base Game',
    'Of Ale And Adventure',
    'Beyond The Vaults',
    'Revenant Retribution',
    'Beasts Of Environ',
    "Oblivion's Maw",
    'Forbidden Creed'
];
const REQUIRED_RULE_COLLECTIONS = ['sentryTypes', 'corrupterTypes', 'heldBackCardTypes'];

function validateInvocation(options) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError('Card Catalog assessment options must be an object.');
    }
    if (!options.candidate || typeof options.candidate !== 'object' || Array.isArray(options.candidate)) {
        throw new TypeError('Card Catalog assessment requires a candidate object.');
    }
    const candidateFields = ['legacyCatalog', 'difficultiesPayload', 'richCatalog', 'sources'];
    if (candidateFields.some(field => !Object.hasOwn(options.candidate, field))) {
        throw new TypeError('Card Catalog candidate is missing canonical candidate fields.');
    }
    if (!isRecord(options.candidate.sources)) {
        throw new TypeError('Card Catalog candidate sources must be an object.');
    }
    const profile = options.profile ?? 'runtime';
    if (!PROFILES.has(profile)) {
        throw new TypeError(`Unknown Card Catalog assessment profile: ${String(profile)}`);
    }
    if (options.savedSnapshots !== undefined && !Array.isArray(options.savedSnapshots)) {
        throw new TypeError('Card Catalog savedSnapshots must be an array when provided.');
    }
    return profile;
}

function toDifficulties(payload) {
    if (Array.isArray(payload)) return payload;
    return Array.isArray(payload?.difficulties) ? payload.difficulties : [];
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assessCardRecords({
    game,
    cards,
    seenIds,
    path,
    fields = ['card', 'type', 'sourceImage'],
    requireGame = true
}) {
    if (!Array.isArray(cards)) return [];
    const reasons = [];
    cards.forEach((card, index) => {
        fields.forEach(field => {
            if (!isNonEmptyString(card?.[field])) {
                reasons.push({
                    code: 'catalog.card_field_missing',
                    path: `${path}[${index}].${field}`,
                    values: { game, index, field }
                });
            }
        });
        if (requireGame && card?.game !== game) {
            reasons.push({
                code: 'catalog.card_game_mismatch',
                path: `${path}[${index}].game`,
                values: { game, index, actual: card?.game }
            });
        }
        if (!Number.isInteger(card?.id) || card.id <= 0) {
            reasons.push({
                code: 'catalog.card_id_invalid',
                path: `${path}[${index}].id`,
                values: { game, index, id: card?.id }
            });
        } else if (seenIds.has(card.id)) {
            reasons.push({
                code: 'catalog.card_id_duplicate',
                path: `${path}[${index}].id`,
                values: { game, index, id: card.id, first: seenIds.get(card.id) }
            });
        } else {
            seenIds.set(card.id, { game, index });
        }
    });
    return reasons;
}

function assessCatalog(catalog) {
    const reasons = [];
    REQUIRED_RULE_COLLECTIONS.forEach(collection => {
        const values = catalog?.[collection];
        if (
            !Array.isArray(values)
            || values.length === 0
            || values.some(value => !isNonEmptyString(value))
        ) {
            reasons.push({
                code: 'catalog.rule_collection_invalid',
                path: `catalog.${collection}`,
                values: { collection }
            });
        }
    });
    REQUIRED_GAMES.forEach(game => {
        const cards = catalog?.games?.[game];
        if (!Array.isArray(cards) || cards.length === 0) {
            reasons.push({
                code: 'catalog.required_game_missing',
                values: { game }
            });
        }
    });

    const seenIds = new Map();
    Object.entries(catalog?.games || {}).forEach(([game, cards]) => {
        reasons.push(...assessCardRecords({
            game,
            cards,
            seenIds,
            path: `catalog.games.${game}`
        }));
    });
    return reasons;
}

function assessDifficulties(difficulties) {
    if (
        difficulties.length > 0
        && difficulties.every(difficulty => (
            difficulty
            && typeof difficulty === 'object'
            && !Array.isArray(difficulty)
            && isNonEmptyString(difficulty.name)
            && Number.isInteger(difficulty.novice)
            && difficulty.novice >= 0
            && Number.isInteger(difficulty.veteran)
            && difficulty.veteran >= 0
        ))
    ) {
        return [];
    }

    return [{
        code: 'catalog.difficulty_invalid',
        path: 'difficulties',
        values: { count: difficulties.length }
    }];
}

function cardsFromRichSource(source) {
    const value = source?.value;
    return Array.isArray(value) ? value : (Array.isArray(value?.cards) ? value.cards : null);
}

function cardSourceIsValid(card, expectedGame) {
    return isRecord(card)
        && Number.isInteger(card.id)
        && card.id > 0
        && isNonEmptyString(card.card)
        && isNonEmptyString(card.type)
        && isNonEmptyString(card.sourceImage)
        && card.game === expectedGame;
}

function legacySourceIsValid(source) {
    const games = source?.value?.games;
    if (!isRecord(games)) return false;
    if (!REQUIRED_GAMES.every(game => Array.isArray(games[game]) && games[game].length > 0)) {
        return false;
    }
    const seenIds = new Set();
    return Object.entries(games).every(([game, cards]) => (
        Array.isArray(cards)
        && cards.length > 0
        && cards.every(card => {
            const validCard = isRecord(card)
                && Number.isInteger(card.id)
                && card.id > 0
                && isNonEmptyString(card.card)
                && isNonEmptyString(card.type)
                && [card.sourceImage, card.contents].some(isNonEmptyString)
                && (!Object.hasOwn(card, 'game') || card.game === game);
            if (!validCard || seenIds.has(card.id)) return false;
            seenIds.add(card.id);
            return true;
        })
    ));
}

function manifestSourceIsValid(source) {
    const manifest = source?.value;
    return isRecord(manifest)
        && isRecord(manifest.games)
        && REQUIRED_GAMES.every(game => isNonEmptyString(manifest.games[game]))
        && REQUIRED_RULE_COLLECTIONS.every(collection => (
            Array.isArray(manifest[collection])
            && manifest[collection].length > 0
            && manifest[collection].every(isNonEmptyString)
        ));
}

function assessRawSourceCards(sources) {
    const reasons = [];
    const legacyIds = new Map();
    if (sources?.legacy?.status === 'success' && isRecord(sources.legacy.value?.games)) {
        Object.entries(sources.legacy.value.games).forEach(([game, cards]) => {
            reasons.push(...assessCardRecords({
                game,
                cards,
                seenIds: legacyIds,
                path: `sources.legacy.games.${game}`,
                fields: ['card', 'type'],
                requireGame: false
            }));
        });
    }
    const richIds = new Map();
    Object.entries(isRecord(sources?.games) ? sources.games : {}).forEach(([game, source]) => {
        if (source?.status !== 'success') return;
        reasons.push(...assessCardRecords({
            game,
            cards: cardsFromRichSource(source),
            seenIds: richIds,
            path: `sources.games.${game}`
        }));
    });
    return reasons;
}

function assessSources(sources) {
    const reasons = [];
    const invalidRichGames = new Set();
    const invalidSources = new Set();
    const fixedSources = ['legacy', 'difficulties', 'manifest', 'icons'];
    fixedSources.forEach(sourceName => {
        if (sources?.[sourceName]?.status !== 'success') {
            invalidSources.add(sourceName);
            reasons.push({
                code: `source.${sourceName}_unavailable`,
                values: { source: sourceName }
            });
        }
    });
    if (sources?.legacy?.status === 'success' && !legacySourceIsValid(sources.legacy)) {
        invalidSources.add('legacy');
        reasons.push({ code: 'source.legacy_invalid', values: { source: 'legacy' } });
    }
    if (
        sources?.difficulties?.status === 'success'
        && assessDifficulties(toDifficulties(sources.difficulties.value)).length > 0
    ) {
        invalidSources.add('difficulties');
        reasons.push({ code: 'source.difficulties_invalid', values: { source: 'difficulties' } });
    }
    if (sources?.manifest?.status === 'success' && !manifestSourceIsValid(sources.manifest)) {
        invalidSources.add('manifest');
        reasons.push({ code: 'source.manifest_invalid', values: { source: 'manifest' } });
    }
    const icons = sources?.icons?.value;
    if (
        sources?.icons?.status === 'success'
        && (
            !isRecord(icons)
            || Object.keys(icons).length === 0
            || Object.values(icons).some(icon => (
                !isRecord(icon)
                || ![icon.asset, icon.path].some(isNonEmptyString)
            ))
        )
    ) {
        invalidSources.add('icons');
        reasons.push({ code: 'source.icons_invalid', values: { source: 'icons' } });
    }
    const manifestGames = isRecord(sources?.manifest?.value?.games)
        ? Object.keys(sources.manifest.value.games)
        : [];
    const gamesToAssess = new Set([
        ...REQUIRED_GAMES,
        ...manifestGames,
        ...Object.keys(isRecord(sources?.games) ? sources.games : {})
    ]);
    const richIds = new Set();
    gamesToAssess.forEach(game => {
        const source = sources?.games?.[game];
        if (source?.status !== 'success') {
            reasons.push({
                code: 'source.rich_game_unavailable',
                values: { game }
            });
            invalidRichGames.add(game);
            return;
        }
        const manifestPath = sources?.manifest?.value?.games?.[game];
        if (!isNonEmptyString(manifestPath) || source.path !== manifestPath) {
            reasons.push({
                code: 'source.rich_game_path_mismatch',
                values: { game, expected: manifestPath, actual: source.path }
            });
            invalidRichGames.add(game);
            return;
        }
        const cards = cardsFromRichSource(source);
        const valid = Array.isArray(cards)
            && cards.length > 0
            && cards.every(card => {
                if (!cardSourceIsValid(card, game) || richIds.has(card.id)) return false;
                richIds.add(card.id);
                return true;
            });
        if (!valid) {
            reasons.push({
                code: 'source.rich_game_invalid',
                values: { game }
            });
            invalidRichGames.add(game);
        }
    });
    reasons.push(...assessRawSourceCards(sources));
    return { reasons, invalidRichGames, invalidSources };
}

function filterUnavailableRichGames(richCatalog, sources, sourceAssessment) {
    if (!richCatalog) return null;
    return {
        ...richCatalog,
        manifest: sourceAssessment.invalidSources.has('manifest') ? null : richCatalog.manifest,
        icons: sourceAssessment.invalidSources.has('icons') ? {} : richCatalog.icons,
        games: Object.fromEntries(
            Object.entries(richCatalog.games || {})
                .filter(([game]) => (
                    sources?.games?.[game]?.status === 'success'
                    && !sourceAssessment.invalidRichGames.has(game)
                ))
        )
    };
}

function measureQuality(snapshot) {
    const cards = Object.values(snapshot.catalog.games || {}).flat();
    return {
        cardCount: cards.length,
        richCardCount: cards.filter(card => card.renderMode === 'rich').length,
        iconCount: Object.keys(snapshot.catalog.icons || {}).length,
        manifestGameCount: Object.keys(snapshot.catalog.cardManifest?.games || {}).length,
        ruleTypeCount: REQUIRED_RULE_COLLECTIONS
            .reduce((count, collection) => count + snapshot.catalog[collection].length, 0),
        difficultyProfileCount: snapshot.difficulties.length
    };
}

function compareQuality(candidateQuality, savedQuality) {
    const regressions = Object.keys(candidateQuality)
        .filter(dimension => candidateQuality[dimension] < savedQuality[dimension]);
    return {
        atLeastAsRich: regressions.length === 0,
        strictlyRicher: Object.keys(candidateQuality)
            .some(dimension => candidateQuality[dimension] > savedQuality[dimension]),
        regressions
    };
}

function assessSavedSnapshot(snapshot, index) {
    const catalog = normalizeCachedCardCatalog(snapshot?.catalog);
    const difficulties = toDifficulties(snapshot?.difficulties);
    const reasons = [...assessCatalog(catalog), ...assessDifficulties(difficulties)];
    if (reasons.length > 0) {
        return {
            usable: false,
            snapshot: null,
            reasons: reasons.map(reason => ({
                ...reason,
                code: `saved.${reason.code}`,
                values: { ...reason.values, savedIndex: index }
            }))
        };
    }
    const normalized = { catalog, difficulties };
    return {
        usable: true,
        snapshot: normalized,
        quality: measureQuality(normalized),
        reasons: []
    };
}

function richCardsForGame(candidate, game) {
    const value = candidate.richCatalog?.games?.[game];
    return Array.isArray(value) ? value : (Array.isArray(value?.cards) ? value.cards : []);
}

function sameIdSet(leftCards, rightCards) {
    const leftIds = leftCards.map(card => card?.id).sort((left, right) => left - right);
    const rightIds = rightCards.map(card => card?.id).sort((left, right) => left - right);
    return leftIds.length === rightIds.length
        && leftIds.every((id, index) => id === rightIds[index]);
}

export function assessCardCatalog(options) {
    const profile = validateInvocation(options);

    const { candidate, savedSnapshots = [] } = options;
    const sourceAssessment = assessSources(candidate.sources);
    const catalog = mergeCardCatalogs(
        isRecord(candidate.legacyCatalog) && !sourceAssessment.invalidSources.has('legacy')
            ? candidate.legacyCatalog
            : {},
        filterUnavailableRichGames(
            candidate.richCatalog,
            candidate.sources,
            sourceAssessment
        )
    );
    const difficulties = toDifficulties(candidate.difficultiesPayload);
    const selected = {
        catalog,
        difficulties
    };
    const catalogReasons = [...assessCatalog(catalog), ...assessDifficulties(difficulties)];
    const sourceReasons = sourceAssessment.reasons;
    const savedAssessments = savedSnapshots.map(assessSavedSnapshot);
    const saved = savedAssessments.find(assessment => assessment.usable) || null;
    const usable = catalogReasons.length === 0;
    const sourceComplete = sourceReasons.length === 0;
    const candidateQuality = usable ? measureQuality(selected) : null;
    const checkedInReasons = [];
    if (profile === 'checked-in') {
        const cardCount = Object.values(catalog.games || {}).flat().length;
        if (cardCount !== 142) {
            checkedInReasons.push({
                code: 'checked_in.card_count_mismatch',
                values: { expected: 142, actual: cardCount }
            });
        }
        REQUIRED_GAMES.forEach(game => {
            const legacyCards = Array.isArray(candidate.legacyCatalog?.games?.[game])
                ? candidate.legacyCatalog.games[game]
                : [];
            const richCards = richCardsForGame(candidate, game);
            if (!sameIdSet(legacyCards, richCards)) {
                checkedInReasons.push({
                    code: 'checked_in.source_id_set_mismatch',
                    values: {
                        game,
                        legacyIds: legacyCards.map(card => card?.id),
                        richIds: richCards.map(card => card?.id)
                    }
                });
            }
        });
    }
    const checkedIn = profile === 'checked-in'
        ? { accepted: usable && sourceComplete && checkedInReasons.length === 0 }
        : undefined;
    const reasons = [
        ...catalogReasons,
        ...sourceReasons,
        ...savedAssessments.flatMap(assessment => assessment.reasons),
        ...checkedInReasons
    ];

    if (profile === 'checked-in' && !checkedIn.accepted) {
        return {
            outcome: 'unavailable',
            selected: null,
            persistCandidate: false,
            candidate: {
                usable,
                sourceComplete,
                persistenceEligible: false,
                quality: candidateQuality
            },
            reasons,
            checkedIn
        };
    }

    if (!usable) {
        if (saved) {
            return {
                outcome: 'use-saved',
                selected: saved.snapshot,
                persistCandidate: false,
                candidate: {
                    usable: false,
                    sourceComplete,
                    persistenceEligible: false,
                    quality: null
                },
                reasons,
                ...(checkedIn ? { checkedIn } : {})
            };
        }
        return {
            outcome: 'unavailable',
            selected: null,
            persistCandidate: false,
            candidate: {
                usable: false,
                sourceComplete,
                persistenceEligible: false,
                quality: null
            },
            reasons,
            ...(checkedIn ? { checkedIn } : {})
        };
    }

    if (saved) {
        const qualityComparison = compareQuality(candidateQuality, saved.quality);
        const savedMustWin = sourceComplete
            ? !qualityComparison.atLeastAsRich
            : !(qualityComparison.atLeastAsRich && qualityComparison.strictlyRicher);
        if (savedMustWin) {
            return {
                outcome: 'use-saved',
                selected: saved.snapshot,
                persistCandidate: false,
                candidate: {
                    usable: true,
                    sourceComplete,
                    persistenceEligible: false,
                    quality: candidateQuality
                },
                reasons: [
                    ...reasons,
                    {
                        code: 'quality.regression',
                        values: {
                            regressions: qualityComparison.regressions,
                            candidate: candidateQuality,
                            saved: saved.quality
                        }
                    }
                ],
                ...(checkedIn ? { checkedIn } : {})
            };
        }
    }

    const selectionReasons = saved && !sourceComplete
        ? [...reasons, {
            code: 'quality.candidate_strictly_richer',
            values: {
                candidate: candidateQuality,
                saved: saved.quality
            }
        }]
        : reasons;
    return {
        outcome: sourceComplete ? 'use-candidate-and-persist' : 'use-candidate-session-only',
        selected,
        persistCandidate: sourceComplete,
        candidate: {
            usable: true,
            sourceComplete,
            persistenceEligible: sourceComplete,
            quality: candidateQuality
        },
        reasons: selectionReasons,
        ...(checkedIn ? { checkedIn } : {})
    };
}
