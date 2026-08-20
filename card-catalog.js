import { loadFreshCardCatalog } from './card-catalog-source.js';
import {
    loadCardCatalogSnapshot,
    loadLegacyCardCatalogSnapshot,
    saveCardCatalogSnapshot
} from './card-catalog-cache.js';
import { assessCardCatalog } from './card-catalog-policy.mjs';

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

function readyResult(status, snapshot, diagnostics = []) {
    return {
        status,
        catalog: snapshot.catalog,
        difficulties: snapshot.difficulties,
        cardIndex: buildCardIndex(snapshot.catalog),
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

function loadSavedSnapshots() {
    const primary = loadCardCatalogSnapshot();
    const snapshots = primary ? [primary] : [];
    if (!primary || !primary.migrated) {
        const legacy = loadLegacyCardCatalogSnapshot();
        if (legacy) snapshots.push(legacy);
    }
    return snapshots;
}

function unavailableCandidate(error) {
    const failure = { status: 'failure', error };
    return {
        legacyCatalog: {},
        difficultiesPayload: null,
        richCatalog: null,
        sources: {
            legacy: failure,
            difficulties: failure,
            manifest: failure,
            icons: failure,
            games: {}
        }
    };
}

function invalidCandidateError(decision) {
    const difficultyInvalid = decision.reasons.some(reason => (
        reason.code === 'catalog.difficulty_invalid'
    ));
    return new Error(difficultyInvalid
        ? 'Fresh difficulty settings are empty or malformed.'
        : 'Fresh Card Catalog is empty or malformed.');
}

function incompleteSourceDiagnostics(decision) {
    if (!decision.candidate.usable || decision.candidate.sourceComplete) return [];
    return [{
        level: 'warn',
        message: 'One or more Card Catalog sources were empty or malformed; using a session-only catalog.'
    }];
}

export const acquireCardCatalog = async function acquireCardCatalog(options) {
    try {
        const fresh = await loadFreshCardCatalog(options);
        const savedSnapshots = loadSavedSnapshots();
        const decision = assessCardCatalog({
            candidate: fresh,
            savedSnapshots,
            profile: 'runtime'
        });
        const sourceDiagnostics = incompleteSourceDiagnostics(decision);
        const diagnostics = [...(fresh.diagnostics || []), ...sourceDiagnostics];

        if (decision.outcome === 'unavailable') {
            return failureResult(invalidCandidateError(decision));
        }

        if (decision.outcome === 'use-saved') {
            if (!decision.candidate.usable) {
                return readyResult('offline', decision.selected, [{
                    level: 'warn',
                    message: 'Fresh Card Catalog unavailable or invalid; using saved data:',
                    error: invalidCandidateError(decision)
                }]);
            }
            return readyResult('offline', decision.selected, [
                ...diagnostics,
                {
                    level: 'warn',
                    message: decision.candidate.sourceComplete
                        ? 'Fetched Card Catalog was lower quality than the saved snapshot; using saved data.'
                        : 'Fetched Card Catalog was incomplete; using the last-known-good saved data.'
                }
            ]);
        }

        if (decision.outcome === 'use-candidate-session-only') {
            const richerSessionDiagnostic = decision.reasons.some(reason => (
                reason.code === 'quality.candidate_strictly_richer'
            ))
                ? [{
                    level: 'warn',
                    message: 'Using a richer session-only Card Catalog; the last-known-good saved snapshot remains unchanged.'
                }]
                : [];
            return readyResult('partial', decision.selected, [
                ...diagnostics,
                ...richerSessionDiagnostic
            ]);
        }

        const didCache = saveCardCatalogSnapshot(
            decision.selected.catalog,
            { difficulties: decision.selected.difficulties }
        );
        const cacheDiagnostics = didCache === false
            ? [{
                level: 'warn',
                message: 'Unable to cache the fetched Card Catalog for offline use.'
            }]
            : [];
        return readyResult('fresh', decision.selected, [...diagnostics, ...cacheDiagnostics]);
    } catch (error) {
        const savedSnapshots = loadSavedSnapshots();
        const decision = assessCardCatalog({
            candidate: unavailableCandidate(error),
            savedSnapshots,
            profile: 'runtime'
        });
        if (decision.outcome !== 'use-saved') return failureResult(error);
        return readyResult(
            'offline',
            decision.selected,
            [{
                level: 'warn',
                message: 'Fresh Card Catalog unavailable or invalid; using saved data:',
                error
            }]
        );
    }
};
