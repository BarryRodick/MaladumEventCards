/**
 * Test suite for card normalization and catalog merging
 * Run with: node tests/cardNormalization.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadModule(relativePath) {
    return import(pathToFileURL(path.join(__dirname, '..', relativePath)).href);
}

(async () => {
    const {
        normalizeCard,
        mergeCardCatalogs,
        normalizeCachedCardCatalog
    } = await loadModule('card-data.mjs');

    console.log('Testing card normalization...');

    const legacyCard = normalizeCard({
        id: 7,
        card: 'Trap! Arrow',
        type: 'Dungeon',
        contents: 'Trap_Arrow.png',
        sections: [
            {
                header: 'DISQUIET',
                text: 'Take 2 [icon:fire] damage.'
            }
        ]
    }, 'Base Game', 'legacy');

    assert.strictEqual(legacyCard.renderMode, 'image', 'Legacy cards should normalize to image render mode');
    assert.strictEqual(legacyCard.sourceImage, 'Trap_Arrow.png');
    assert.strictEqual(legacyCard.contents, 'Trap_Arrow.png', 'Normalized cards should preserve contents for compatibility');
    assert.strictEqual(legacyCard.sections[0].text, 'Take 2 [fire] damage.', 'Legacy icon syntax should be normalized');
    assert(legacyCard.searchText.includes('trap! arrow') || legacyCard.searchText.includes('trap arrow'),
        'Normalized search text should include the card title');

    const richCard = normalizeCard({
        id: 7,
        card: 'Trap! Arrow',
        slug: 'trap-arrow',
        type: 'Dungeon',
        sourceImage: 'Trap_Arrow.png',
        sections: [
            {
                kind: 'mode',
                label: 'DISQUIET',
                text: 'Take 2 [fire] damage.'
            }
        ],
        footer: {
            left: [{ type: 'icon', name: 'grave' }],
            right: []
        },
        extraction: {
            status: 'auto',
            confidence: 0.9,
            issues: [],
            managedBy: 'extractor'
        },
        searchText: 'todo'
    }, 'Base Game', 'rich');

    assert.strictEqual(richCard.renderMode, 'rich', 'Rich cards should normalize to rich render mode');
    assert.strictEqual(richCard.footer.left[0].name, 'grave');
    assert.notStrictEqual(richCard.searchText, 'todo',
        'Normalization should never trust stale stored search text');
    assert(richCard.searchText.includes('take 2 fire damage'),
        'Normalized search text should be rebuilt from normalized rules content');

    const needsReviewCard = normalizeCard({
        id: 133,
        card: 'Sudden Rot',
        type: 'Veteran',
        sourceImage: 'Sudden_Rot.png',
        sections: [{
            kind: 'mode',
            label: 'DISQUIET-DOOM',
            text: 'The odour of decaying food fills the air.'
        }],
        extraction: {
            status: 'needs-review',
            confidence: 0.8,
            issues: ['The item-art list is incomplete.'],
            managedBy: 'human'
        }
    }, 'Base Game', 'rich');

    assert.strictEqual(needsReviewCard.renderMode, 'image',
        'Incomplete rich records should render their authoritative source image');
    assert.strictEqual(needsReviewCard.sourceImage, 'Sudden_Rot.png');
    assert(needsReviewCard.sections[0].text.includes('decaying food'),
        'Image-fallback records should retain structured rich metadata');
    assert(needsReviewCard.searchText.includes('odour of decaying food'),
        'Image-fallback records should retain searchable rich rules');

    const verifiedCard = normalizeCard({
        ...needsReviewCard,
        extraction: {
            status: 'verified',
            confidence: 1,
            issues: [],
            managedBy: 'human'
        }
    }, 'Base Game', 'rich');
    assert.strictEqual(verifiedCard.renderMode, 'rich',
        'Verified rich records should continue to use structured rendering');

    const merged = mergeCardCatalogs({
        sentryTypes: ['Revenant'],
        corrupterTypes: [],
        heldBackCardTypes: ['Veteran'],
        games: {
            'Base Game': [{
                id: 7,
                card: 'Trap! Arrow',
                type: 'Dungeon',
                contents: 'Trap_Arrow.png',
                sections: [{ header: 'DISQUIET', text: 'Legacy text' }]
            }]
        }
    }, {
        manifest: {
            sentryTypes: ['Revenant'],
            corrupterTypes: [],
            heldBackCardTypes: ['Veteran']
        },
        icons: {},
        games: {
            'Base Game': {
                game: 'Base Game',
                cards: [{
                    id: 7,
                    card: 'Trap! Arrow',
                    slug: 'trap-arrow',
                    type: 'Dungeon',
                    sourceImage: 'Trap_Arrow.png',
                    sections: [{ kind: 'mode', label: 'DISQUIET', text: 'Rich text' }],
                    footer: { left: [], right: [] },
                    searchText: 'trap arrow rich text',
                    extraction: { status: 'auto', confidence: 0.9, issues: [], managedBy: 'extractor' }
                }]
            }
        }
    });

    assert.strictEqual(merged.games['Base Game'][0].renderMode, 'rich',
        'Rich cards should override legacy cards by id during merge');
    assert.strictEqual(merged.games['Base Game'][0].type, 'Dungeon',
        'Merged cards should preserve type semantics for deck logic');

    const normalizedCache = normalizeCachedCardCatalog({
        games: {
            'Base Game': [{ ...verifiedCard, renderMode: 'image', searchText: 'todo' }]
        }
    });
    assert.notStrictEqual(normalizedCache.games['Base Game'][0].searchText, 'todo',
        'Offline cached catalogs should also rebuild search text from card content');
    assert.strictEqual(normalizedCache.games['Base Game'][0].renderMode, 'rich',
        'Verified cached records should recover structured rendering from extraction metadata');

    console.log('All card normalization tests passed!');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
