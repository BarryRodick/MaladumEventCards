import assert from 'node:assert/strict';

import { assessCardCatalog } from '../card-catalog-policy.mjs';

const REQUIRED_GAMES = [
    'Base Game',
    'Of Ale And Adventure',
    'Beyond The Vaults',
    'Revenant Retribution',
    'Beasts Of Environ',
    "Oblivion's Maw",
    'Forbidden Creed'
];

function cardFor(game, id) {
    return {
        id,
        card: `${game} Card`,
        type: 'Environment',
        game,
        sourceImage: `${id}.png`,
        contents: `${id}.png`
    };
}

function completeCandidate() {
    const games = Object.fromEntries(
        REQUIRED_GAMES.map((game, index) => [game, [cardFor(game, index + 1)]])
    );
    const manifest = {
        sentryTypes: ['Revenant'],
        corrupterTypes: ['Corrupter'],
        heldBackCardTypes: ['Novice'],
        games: Object.fromEntries(REQUIRED_GAMES.map(game => [game, `${game}.json`]))
    };
    const difficulties = {
        difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }]
    };
    const richGames = Object.fromEntries(
        Object.entries(games).map(([game, cards]) => [
            game,
            { cards: cards.map(card => ({ ...card })) }
        ])
    );

    return {
        legacyCatalog: { ...manifest, games },
        difficultiesPayload: difficulties,
        richCatalog: {
            manifest,
            icons: { grave: { asset: 'assets/icons/grave.svg' } },
            games: richGames
        },
        sources: {
            legacy: { status: 'success', value: { ...manifest, games } },
            difficulties: { status: 'success', value: difficulties },
            manifest: { status: 'success', value: manifest },
            icons: { status: 'success', value: { grave: { asset: 'assets/icons/grave.svg' } } },
            games: Object.fromEntries(
                Object.entries(richGames).map(([game, value]) => [
                    game,
                    { status: 'success', path: `${game}.json`, value }
                ])
            )
        }
    };
}

function savedSnapshot({ extraBaseCard = false } = {}) {
    const games = Object.fromEntries(
        REQUIRED_GAMES.map((game, index) => [game, [cardFor(game, index + 1)]])
    );
    if (extraBaseCard) {
        games['Base Game'].push(cardFor('Base Game', 100));
    }
    return {
        catalog: {
            sentryTypes: ['Revenant'],
            corrupterTypes: ['Corrupter'],
            heldBackCardTypes: ['Novice'],
            games,
            icons: { grave: { asset: 'assets/icons/grave.svg' } },
            cardManifest: {
                games: Object.fromEntries(REQUIRED_GAMES.map(game => [game, `${game}.json`]))
            }
        },
        difficulties: [{ name: 'Novice', novice: 1, veteran: 0 }]
    };
}

console.log('Testing Card Catalog acceptance policy...');

{
    const decision = assessCardCatalog({ candidate: completeCandidate() });

    assert.equal(decision.outcome, 'use-candidate-and-persist');
    assert.equal(decision.persistCandidate, true);
    assert.equal(decision.candidate.usable, true);
    assert.equal(decision.candidate.sourceComplete, true);
    assert.equal(Object.keys(decision.selected.catalog.games).length, 7);
}

{
    const candidate = completeCandidate();
    delete candidate.legacyCatalog.games['Forbidden Creed'];
    delete candidate.richCatalog.games['Forbidden Creed'];
    delete candidate.sources.games['Forbidden Creed'];

    const decision = assessCardCatalog({ candidate });

    assert.equal(decision.outcome, 'unavailable');
    assert.equal(decision.selected, null);
    assert.equal(decision.persistCandidate, false);
    assert.equal(decision.candidate.usable, false);
    assert(decision.reasons.some(reason => (
        reason.code === 'catalog.required_game_missing'
        && reason.values.game === 'Forbidden Creed'
    )));
}

{
    const candidate = completeCandidate();
    candidate.legacyCatalog.games['Base Game'][0].id = 0;
    candidate.richCatalog.games['Base Game'].cards[0].id = 0;
    candidate.sources.legacy.value.games['Base Game'][0].id = 0;
    candidate.sources.games['Base Game'].value.cards[0].id = 0;

    const decision = assessCardCatalog({ candidate });

    assert.equal(decision.candidate.usable, false);
    assert(decision.reasons.some(reason => (
        reason.code === 'catalog.card_id_invalid'
        && reason.values.game === 'Base Game'
        && reason.values.id === 0
    )));
}

{
    const candidate = completeCandidate();
    candidate.legacyCatalog.games['Forbidden Creed'][0].id = 1;
    candidate.richCatalog.games['Forbidden Creed'].cards[0].id = 1;
    candidate.sources.legacy.value.games['Forbidden Creed'][0].id = 1;
    candidate.sources.games['Forbidden Creed'].value.cards[0].id = 1;

    const decision = assessCardCatalog({ candidate });

    assert.equal(decision.candidate.usable, false);
    assert(decision.reasons.some(reason => (
        reason.code === 'catalog.card_id_duplicate'
        && reason.values.id === 1
    )));
}

{
    const candidate = completeCandidate();
    candidate.legacyCatalog.games['Base Game'][0].card = '';
    candidate.richCatalog.games['Base Game'].cards[0].card = '';
    candidate.sources.legacy.value.games['Base Game'][0].card = '';
    candidate.sources.games['Base Game'].value.cards[0].card = '';

    const decision = assessCardCatalog({ candidate });

    assert.equal(decision.candidate.usable, false);
    assert(decision.reasons.some(reason => (
        reason.code === 'catalog.card_field_missing'
        && reason.values.field === 'card'
    )));
}

{
    const candidate = completeCandidate();
    candidate.legacyCatalog.sentryTypes = [];
    candidate.richCatalog.manifest.sentryTypes = [];
    candidate.sources.legacy.value.sentryTypes = [];
    candidate.sources.manifest.value.sentryTypes = [];

    const decision = assessCardCatalog({ candidate });

    assert.equal(decision.candidate.usable, false);
    assert(decision.reasons.some(reason => (
        reason.code === 'catalog.rule_collection_invalid'
        && reason.values.collection === 'sentryTypes'
    )));
}

{
    const candidate = completeCandidate();
    candidate.difficultiesPayload.difficulties[0].novice = -1;
    candidate.sources.difficulties.value.difficulties[0].novice = -1;

    const decision = assessCardCatalog({ candidate });

    assert.equal(decision.candidate.usable, false);
    assert(decision.reasons.some(reason => reason.code === 'catalog.difficulty_invalid'));
}

{
    const candidate = completeCandidate();
    candidate.sources.games['Base Game'] = {
        status: 'failure',
        path: 'Base Game.json',
        error: new Error('offline')
    };

    const decision = assessCardCatalog({ candidate });

    assert.equal(decision.outcome, 'use-candidate-session-only');
    assert.equal(decision.candidate.usable, true);
    assert.equal(decision.candidate.sourceComplete, false);
    assert.equal(decision.persistCandidate, false);
    assert(decision.reasons.some(reason => (
        reason.code === 'source.rich_game_unavailable'
        && reason.values.game === 'Base Game'
    )));
}

{
    const candidate = completeCandidate();
    candidate.legacyCatalog = null;
    candidate.sources.legacy = {
        status: 'failure',
        path: 'maladumcards.json',
        error: new Error('offline')
    };

    const decision = assessCardCatalog({ candidate });

    assert.equal(decision.outcome, 'use-candidate-session-only');
    assert.equal(decision.candidate.usable, true);
    assert.equal(decision.candidate.sourceComplete, false);
}

{
    const candidate = completeCandidate();
    candidate.sources.games['Base Game'] = {
        status: 'failure',
        path: 'Base Game.json',
        error: new Error('offline')
    };
    const saved = savedSnapshot({ extraBaseCard: true });

    const decision = assessCardCatalog({
        candidate,
        savedSnapshots: [saved]
    });

    assert.equal(decision.outcome, 'use-saved');
    assert.equal(decision.selected.catalog.games['Base Game'].length, 2);
    assert.equal(decision.persistCandidate, false);
    assert(decision.reasons.some(reason => reason.code === 'quality.regression'));
}

{
    const saved = savedSnapshot();
    saved.difficulties.push({ name: 'Veteran', novice: 0, veteran: 1 });

    const decision = assessCardCatalog({
        candidate: completeCandidate(),
        savedSnapshots: [saved]
    });

    assert.equal(decision.outcome, 'use-saved');
    assert(decision.reasons.some(reason => (
        reason.code === 'quality.regression'
        && reason.values.regressions.includes('difficultyProfileCount')
    )));
}

{
    const candidate = completeCandidate();
    delete candidate.legacyCatalog.games['Forbidden Creed'];
    delete candidate.richCatalog.games['Forbidden Creed'];
    delete candidate.sources.games['Forbidden Creed'];
    const first = savedSnapshot();
    const second = savedSnapshot();
    first.catalog.games['Base Game'][0].card = 'Atomic snapshot';
    second.catalog.games['Base Game'][0].card = 'Legacy snapshot';

    const decision = assessCardCatalog({
        candidate,
        savedSnapshots: [first, second]
    });

    assert.equal(decision.outcome, 'use-saved');
    assert.equal(decision.selected.catalog.games['Base Game'][0].card, 'Atomic snapshot');
}

{
    const candidate = completeCandidate();
    delete candidate.legacyCatalog.games['Forbidden Creed'];
    delete candidate.richCatalog.games['Forbidden Creed'];
    delete candidate.sources.games['Forbidden Creed'];
    const malformedAtomic = savedSnapshot();
    delete malformedAtomic.catalog.games['Forbidden Creed'];
    const legacy = savedSnapshot();
    legacy.catalog.games['Base Game'][0].card = 'Legacy recovery';

    const decision = assessCardCatalog({
        candidate,
        savedSnapshots: [malformedAtomic, legacy]
    });

    assert.equal(decision.outcome, 'use-saved');
    assert.equal(decision.selected.catalog.games['Base Game'][0].card, 'Legacy recovery');
    assert(decision.reasons.some(reason => reason.values?.savedIndex === 0));
}

{
    const candidate = completeCandidate();
    candidate.richCatalog.icons = {};
    candidate.sources.icons.value = {};

    const decision = assessCardCatalog({ candidate });

    assert.equal(decision.outcome, 'use-candidate-session-only');
    assert.equal(decision.candidate.usable, true);
    assert.equal(decision.candidate.sourceComplete, false);
    assert.deepEqual(decision.selected.catalog.icons, {});
    assert(decision.reasons.some(reason => reason.code === 'source.icons_invalid'));
}

{
    const candidate = completeCandidate();
    candidate.sources.legacy.value = { games: [] };

    const decision = assessCardCatalog({ candidate });

    assert.equal(decision.outcome, 'use-candidate-session-only');
    assert.equal(decision.candidate.sourceComplete, false);
    assert(decision.reasons.some(reason => reason.code === 'source.legacy_invalid'));
}

{
    const candidate = completeCandidate();
    delete candidate.sources.manifest.value.games['Forbidden Creed'];

    const decision = assessCardCatalog({ candidate });

    assert.equal(decision.outcome, 'use-candidate-session-only');
    assert.equal(decision.candidate.sourceComplete, false);
    assert.deepEqual(decision.selected.catalog.cardManifest, {});
    assert(decision.reasons.some(reason => reason.code === 'source.manifest_invalid'));
}

{
    const candidate = completeCandidate();
    candidate.sources.games['Base Game'].value.cards[0] = null;

    const decision = assessCardCatalog({ candidate });

    assert.equal(decision.outcome, 'use-candidate-session-only');
    assert.equal(decision.selected.catalog.games['Base Game'][0].renderMode, 'image');
    assert(decision.reasons.some(reason => (
        reason.code === 'source.rich_game_invalid'
        && reason.values.game === 'Base Game'
    )));
}

{
    const candidate = completeCandidate();
    const game = 'Expansion Preview';
    const sourcePath = 'Expansion Preview.json';
    candidate.richCatalog.manifest.games[game] = sourcePath;
    candidate.richCatalog.games[game] = { cards: [] };
    candidate.sources.games[game] = {
        status: 'success',
        path: sourcePath,
        value: candidate.richCatalog.games[game]
    };

    const decision = assessCardCatalog({ candidate });

    assert.equal(decision.outcome, 'use-candidate-session-only');
    assert.equal(decision.persistCandidate, false);
    assert(decision.reasons.some(reason => (
        reason.code === 'source.rich_game_invalid'
        && reason.values.game === game
    )));
}

{
    const candidate = completeCandidate();
    candidate.sources.games['Base Game'] = {
        status: 'failure',
        path: 'Base Game.json',
        error: new Error('offline')
    };
    candidate.richCatalog.games['Of Ale And Adventure'].cards.push({
        ...candidate.richCatalog.games['Of Ale And Adventure'].cards[0],
        id: 100,
        card: 'Richer session card'
    });
    candidate.sources.games['Of Ale And Adventure'].value =
        candidate.richCatalog.games['Of Ale And Adventure'];

    const decision = assessCardCatalog({
        candidate,
        savedSnapshots: [savedSnapshot()]
    });

    assert.equal(decision.outcome, 'use-candidate-session-only');
    assert(decision.reasons.some(reason => reason.code === 'quality.candidate_strictly_richer'));
}

{
    const decision = assessCardCatalog({
        candidate: completeCandidate(),
        profile: 'checked-in'
    });

    assert.equal(decision.candidate.usable, true);
    assert.equal(decision.checkedIn.accepted, false);
    assert.equal(decision.outcome, 'unavailable');
    assert.equal(decision.persistCandidate, false);
    assert(decision.reasons.some(reason => (
        reason.code === 'checked_in.card_count_mismatch'
        && reason.values.expected === 142
        && reason.values.actual === 7
    )));
}

{
    const candidate = completeCandidate();
    candidate.richCatalog.games['Base Game'].cards[0].id = 99;
    candidate.sources.games['Base Game'].value.cards[0].id = 99;

    const decision = assessCardCatalog({ candidate, profile: 'checked-in' });

    assert.equal(decision.checkedIn.accepted, false);
    assert(decision.reasons.some(reason => (
        reason.code === 'checked_in.source_id_set_mismatch'
        && reason.values.game === 'Base Game'
    )));
}

{
    const candidate = completeCandidate();
    for (let id = 8; id <= 143; id += 1) {
        const card = cardFor('Base Game', id);
        candidate.legacyCatalog.games['Base Game'].push(card);
        candidate.richCatalog.games['Base Game'].cards.push({ ...card });
        candidate.sources.games['Base Game'].value.cards =
            candidate.richCatalog.games['Base Game'].cards;
    }

    const decision = assessCardCatalog({ candidate, profile: 'runtime' });

    assert.equal(decision.outcome, 'use-candidate-and-persist');
    assert.equal(decision.candidate.usable, true);
}

{
    assert.throws(
        () => assessCardCatalog({ candidate: {} }),
        error => error instanceof TypeError
            && error.message.includes('candidate')
    );
}

{
    const candidate = completeCandidate();
    const before = structuredClone(candidate);

    const first = assessCardCatalog({ candidate });
    const second = assessCardCatalog({ candidate });

    assert.deepEqual(candidate, before);
    assert.deepEqual(first.reasons, second.reasons);
    assert.throws(
        () => assessCardCatalog({ candidate, profile: 'release' }),
        error => error instanceof TypeError && error.message.includes('profile')
    );
}

console.log('All Card Catalog acceptance policy tests passed!');
