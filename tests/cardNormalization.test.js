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
    const { normalizeCard, mergeCardCatalogs } = await loadModule('card-data.mjs');

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
        }
    }, 'Base Game', 'rich');

    assert.strictEqual(richCard.renderMode, 'rich', 'Rich cards should normalize to rich render mode');
    assert.strictEqual(richCard.footer.left[0].name, 'grave');

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

    console.log('All card normalization tests passed!');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
