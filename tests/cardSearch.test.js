/**
 * Test suite for structured card search
 * Run with: node tests/cardSearch.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadModule(relativePath) {
    return import(pathToFileURL(path.join(__dirname, '..', relativePath)).href);
}

(async () => {
    const { normalizeCard, searchCards } = await loadModule('card-data.mjs');

    console.log('Testing structured card search...');

    const cards = [
        normalizeCard({
            id: 50,
            card: 'Fresh Graves',
            type: 'Revenant + Veteran',
            contents: 'Fresh_Graves.png',
            sections: [
                {
                    header: 'DISTRESS-DOOM',
                    text: 'Place four Grave Point markers as close as possible to the last place searched.'
                }
            ]
        }, 'Base Game', 'legacy'),
        normalizeCard({
            id: 51,
            card: 'Alarm!',
            type: 'Environment',
            contents: 'Alarm.png',
            sections: [
                {
                    header: 'DISQUIET',
                    text: 'Increase the Dread by 1.'
                }
            ]
        }, 'Base Game', 'legacy')
    ];

    const graveMatches = searchCards(cards, 'grave searched');
    assert.strictEqual(graveMatches.length, 1, 'Search should match rules text, not just title');
    assert.strictEqual(graveMatches[0].id, 50);

    const titleMatches = searchCards(cards, 'alarm');
    assert.strictEqual(titleMatches[0].id, 51, 'Title search behavior should still work');

    const repositoryRoot = path.join(__dirname, '..');
    const manifest = JSON.parse(fs.readFileSync(
        path.join(repositoryRoot, 'data', 'cards', 'manifest.json'),
        'utf8'
    ));
    const productionCards = Object.entries(manifest.games).flatMap(([gameName, relativePath]) => {
        const payload = JSON.parse(fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8'));
        return (Array.isArray(payload) ? payload : payload.cards || [])
            .map(card => normalizeCard(card, gameName, 'rich'));
    });

    assert(productionCards.length > 0, 'The production rich catalog should be present for search coverage');
    assert.strictEqual(productionCards.some(card => card.searchText === 'todo'), false,
        'No normalized production rich card should retain a placeholder search index');

    const productionRulesMatches = searchCards(productionCards, 'odour decaying');
    const suddenRot = productionRulesMatches.find(card => card.card === 'Sudden Rot');
    assert(suddenRot, 'Production search should find Sudden Rot from its rules text');
    assert.strictEqual(suddenRot.renderMode, 'image',
        'The incomplete Sudden Rot record should stay searchable while using its source image');

    console.log('All structured card search tests passed!');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
