/**
 * Test suite for extraction helpers
 * Run with: node tests/cardExtraction.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadModule(relativePath) {
    return import(pathToFileURL(path.join(__dirname, '..', relativePath)).href);
}

(async () => {
    const {
        buildFooterMetadata,
        buildRichRecord,
        titlesRoughlyMatch
    } = await loadModule('scripts/extract-cards.mjs');
    const {
        finalizeExtractionMetadata
    } = await loadModule('scripts/enrich-cards-openrouter.mjs');

    console.log('Testing extraction helpers...');

    assert.strictEqual(titlesRoughlyMatch('Fresh Graves', 'FRESH GRAVES'), true,
        'Title matching should be case-insensitive and punctuation-tolerant');

    const footer = buildFooterMetadata({
        footerLeftHasContent: true,
        footerRightHasContent: true,
        footerLabelText: 'LARGER AND/OR MULTI-LEVEL GAMING AREAS',
        footerLabelConfidence: 0.8
    });
    assert.strictEqual(footer.footer.left[0].name, 'unknown-icon');
    assert.strictEqual(footer.footer.right[0].text, 'LARGER AND/OR MULTI-LEVEL GAMING AREAS');
    assert(footer.issues.length > 0, 'Unmatched footer icons should force manual review');

    const richCard = buildRichRecord({
        id: 3,
        card: 'Balefire',
        type: 'Revenant',
        contents: 'Balefire.png',
        sections: [
            {
                header: 'DISQUIET-DOOM',
                threshold: 2,
                text: 'The Malagaunt channels its magic through one of its minions with [icon:fire].'
            }
        ]
    }, 'Base Game', {
        footerLeftHasContent: false,
        footerRightHasContent: false,
        footerLabelText: '',
        footerLabelConfidence: 0,
        titleText: 'BALEFIRE',
        titleConfidence: 0.9,
        primaryHeaderText: 'DISQUIET-DOOM',
        secondaryHeaderText: '',
        regions: {}
    });

    assert.strictEqual(richCard.renderMode, 'rich');
    assert.strictEqual(richCard.sections[0].text.includes('[fire]'), true,
        'Extraction should normalize inline icon tokens into bracket syntax');
    assert.strictEqual(richCard.extraction.status, 'auto',
        'Confident seeded extraction without issues should be auto status');

    const needsReview = finalizeExtractionMetadata({
        footer: {
            left: [{ type: 'icon', name: 'unknown-icon' }],
            right: []
        }
    }, {
        footer: {
            left: [{ type: 'icon', name: 'grave' }],
            right: [{ type: 'icon', name: 'unknown-icon' }]
        },
        sections: [{ text: 'Move [move:3].' }]
    }, {
        status: 'verified',
        confidence: 0.92,
        issues: []
    });

    assert.strictEqual(needsReview.status, 'needs-review',
        'Unknown footer icons must keep enrichment in needs-review state');
    assert(needsReview.issues.some(issue => issue.includes('unresolved icon')),
        'Unknown footer icons should add an explicit review issue');

    const cleanAuto = finalizeExtractionMetadata({
        footer: {
            left: [{ type: 'icon', name: 'unknown-icon' }],
            right: []
        }
    }, {
        footer: {
            left: [{ type: 'icon', name: 'grave' }],
            right: [{ type: 'label', text: 'LARGER AND/OR MULTI-LEVEL GAMING AREAS' }]
        },
        sections: [{ text: 'Take 2 [fire] damage.' }]
    }, {
        status: 'verified',
        confidence: 0.93,
        issues: []
    });

    assert.strictEqual(cleanAuto.status, 'auto',
        'Clean automated enrichment should be promoted to auto, not verified');

    console.log('All extraction helper tests passed!');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
