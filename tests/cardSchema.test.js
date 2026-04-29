/**
 * Test suite for structured card schema validation
 * Run with: node tests/cardSchema.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadModule(relativePath) {
    return import(pathToFileURL(path.join(__dirname, '..', relativePath)).href);
}

(async () => {
    const {
        validateCardManifest,
        validateIconManifest,
        validateRichCardRecord
    } = await loadModule('card-schema.mjs');

    console.log('Testing structured card schema validation...');

    const manifestErrors = validateCardManifest({
        sentryTypes: ['Revenant'],
        corrupterTypes: ['Corrupter'],
        heldBackCardTypes: ['Veteran'],
        games: {
            'Base Game': 'data/cards/base-game.json'
        }
    });
    assert.deepStrictEqual(manifestErrors, [], 'Valid manifest should pass validation');

    const iconErrors = validateIconManifest({
        fire: {
            aliases: ['flame'],
            asset: 'assets/icons/fire.svg'
        }
    });
    assert.deepStrictEqual(iconErrors, [], 'Valid icon manifest should pass validation');

    const richCardErrors = validateRichCardRecord({
        id: 50,
        card: 'Fresh Graves',
        slug: 'fresh-graves',
        type: 'Revenant + Veteran',
        game: 'Base Game',
        sourceImage: 'Fresh_Graves.png',
        renderMode: 'rich',
        sections: [
            {
                kind: 'mode',
                label: 'DISQUIET',
                text: 'Increase Dread by 1.'
            }
        ],
        footer: {
            left: [{ type: 'icon', name: 'grave' }],
            right: []
        },
        searchText: 'fresh graves revenant veteran increase dread by 1',
        tokens: { style: 'inline-bracket' },
        extraction: {
            status: 'needs-review',
            confidence: 0.7,
            issues: ['footer icons auto-detected'],
            managedBy: 'extractor'
        }
    });
    assert.deepStrictEqual(richCardErrors, [], 'Valid rich card should pass validation');

    const invalidErrors = validateRichCardRecord({
        id: 'oops',
        card: '',
        slug: '',
        type: '',
        game: '',
        sourceImage: '',
        sections: [],
        footer: {},
        searchText: '',
        extraction: {
            status: 'unknown'
        }
    });
    assert(invalidErrors.length >= 6, 'Invalid rich card should surface multiple errors');

    console.log('All structured card schema tests passed!');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
