/**
 * Test suite for rich card icon coverage
 * Run with: node tests/cardCatalogCoverage.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadModule(relativePath) {
    return import(pathToFileURL(path.join(__dirname, '..', relativePath)).href);
}

function loadJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'));
}

function createNode(tagName = 'div', nodeType = 1, value = '') {
    return {
        nodeType,
        tagName: nodeType === 1 ? String(tagName).toUpperCase() : undefined,
        children: [],
        attributes: {},
        dataset: {},
        className: '',
        textContent: value,
        src: '',
        alt: '',
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        setAttribute(name, attributeValue) {
            this.attributes[name] = String(attributeValue);
        }
    };
}

function createDocumentStub() {
    return {
        createDocumentFragment() {
            return createNode('fragment', 11);
        },
        createTextNode(text) {
            return createNode('', 3, text);
        },
        createElement(tagName) {
            return createNode(tagName, 1);
        }
    };
}

function collectByClass(node, className, matches = []) {
    if (!node || typeof node !== 'object') {
        return matches;
    }

    const classes = String(node.className || '').split(/\s+/).filter(Boolean);
    if (classes.includes(className)) {
        matches.push(node);
    }

    (node.children || []).forEach(child => collectByClass(child, className, matches));
    return matches;
}

async function loadCatalog() {
    const { mergeCardCatalogs } = await loadModule('card-data.mjs');
    const legacyCatalog = loadJson('maladumcards.json');
    const manifest = loadJson('data/cards/manifest.json');
    const icons = loadJson('data/cards/icons.json');
    const richGames = Object.fromEntries(
        Object.entries(manifest.games || {}).map(([gameName, relativePath]) => [gameName, loadJson(relativePath)])
    );

    return mergeCardCatalogs(legacyCatalog, {
        manifest,
        icons,
        games: richGames
    });
}

(async () => {
    const catalog = await loadCatalog();
    const { tokenizeCardText, resolveIconEntry } = await loadModule('card-tokenizer.mjs');
    const { renderCardNode } = await loadModule('card-renderer.mjs');

    console.log('Testing card catalog icon coverage...');

    const allCards = Object.values(catalog.games).flat();
    assert.strictEqual(allCards.length, 142,
        'The consolidated catalog should contain all 142 reviewed cards');
    assert(allCards.every(card => card.extraction?.status === 'verified' && card.extraction?.managedBy === 'human'),
        'Every consolidated rich card should remain human-managed and verified');
    const unresolvedInlineTokens = [];
    const unresolvedFooterIcons = [];

    allCards.forEach(card => {
        (card.sections || []).forEach(section => {
            tokenizeCardText(section.text || '').forEach(part => {
                if (part.kind === 'icon' && !resolveIconEntry(catalog.icons, part.name)) {
                    unresolvedInlineTokens.push({
                        id: card.id,
                        card: card.card,
                        token: part.name
                    });
                }
            });
        });

        ['left', 'right'].forEach(side => {
            (card.footer?.[side] || []).forEach(item => {
                if (item.type === 'icon' && !resolveIconEntry(catalog.icons, item.name)) {
                    unresolvedFooterIcons.push({
                        id: card.id,
                        card: card.card,
                        icon: item.name,
                        side
                    });
                }
            });
        });
    });

    assert.deepStrictEqual(unresolvedInlineTokens, [],
        'Every inline token in the rich card catalog should resolve to a configured icon');
    assert.deepStrictEqual(unresolvedFooterIcons, [],
        'Every footer icon in the rich card catalog should resolve to a configured icon');

    const cardById = (id) => {
        const card = allCards.find(entry => entry.id === id);
        assert(card, `Expected rich card ${id} to exist in the merged catalog`);
        return card;
    };
    const footerTokens = card => ({
        left: (card.footer?.left || []).map(item => item.type === 'label' ? item.text : item.name),
        right: (card.footer?.right || []).map(item => item.type === 'label' ? item.text : item.name)
    });
    const sectionText = card => (card.sections || []).map(section => section.text || '').join('\n');
    const sectionLabels = card => (card.sections || []).map(section => section.label || '').filter(Boolean);
    const countToken = (text, token) => (String(text).match(new RegExp(`\\[${token}\\]`, 'g')) || []).length;

    [
        { id: 65, token: 'revenant' },
        { id: 78, token: 'blue-reminder' },
        { id: 78, token: 'red-reminder' },
        { id: 78, token: 'yellow-reminder' },
        { id: 95, token: 'actions' },
        { id: 43, token: 'vicious' },
        { id: 43, token: 'quickstrike' },
        { id: 43, token: 'cleave' },
        { id: 53, token: 'hit-and-run' },
        { id: 63, token: 'potion' },
        { id: 134, token: 'sundering' },
        { id: 142, token: 'wounded' }
    ].forEach(({ id, token }) => {
        assert(resolveIconEntry(catalog.icons, token),
            `Card ${id} should resolve the ${token} inline token`);
    });

    [35, 70, 80, 100].forEach(id => {
        const card = cardById(id);
        ['left', 'right'].forEach(side => {
            (card.footer?.[side] || [])
                .filter(item => item.type === 'icon')
                .forEach(item => {
                    assert(resolveIconEntry(catalog.icons, item.name),
                        `${card.card} should resolve footer icon ${item.name}`);
                });
        });
    });

    [43, 53, 63, 65, 78, 95, 134, 142].forEach(id => {
        const card = cardById(id);
        const rendered = renderCardNode(card, {
            document: createDocumentStub(),
            iconRegistry: catalog.icons
        });
        assert.strictEqual(collectByClass(rendered, 'card-inline-token--unknown').length, 0,
            `${card.card} should render without unresolved token placeholders`);
    });

    {
        const corruptTalisman = cardById(102);
        const sectionText = corruptTalisman.sections.map(section => section.text).join('\n');
        assert(sectionText.includes('[corrupter]'),
            'Corrupt Talisman should use the green Corrupter token from the source card');
        assert(!sectionText.includes('[malacytic-conduit]'),
            'Corrupt Talisman should not use the blue Malacytic Conduit token');
        assert.deepStrictEqual(corruptTalisman.footer.left, [{ type: 'icon', name: 'corrupter' }],
            'Corrupt Talisman footer should use the Corrupter icon');
        assert.strictEqual(resolveIconEntry(catalog.icons, 'corrupter')?.asset, 'logos/Corrupter.jpg',
            'The Corrupter token should render with the green Corrupter emblem');
    }

    {
        ['environment', 'dungeon', 'novice', 'veteran', 'malagaunt', 'wandering-beast', 'cabal', 'location']
            .forEach(token => {
                assert(resolveIconEntry(catalog.icons, token),
                    `The ${token} source emblem should resolve through the icon manifest`);
            });

        assert.deepStrictEqual(footerTokens(cardById(3)).left, ['revenant'],
            'Balefire footer should use the printed Revenant emblem, not a generic creature token');
        assert.deepStrictEqual(footerTokens(cardById(17)).left, ['malagaunt'],
            'Death Draws In footer should use the printed Malagaunt emblem');
        assert.deepStrictEqual(footerTokens(cardById(50)).left, ['revenant', '+', 'veteran'],
            'Fresh Graves footer should use the printed Revenant + Veteran emblems');
        assert.deepStrictEqual(footerTokens(cardById(70)).left, ['dungeon', '+', 'denizen'],
            'Heigh-Ho, Heigh-Ho! footer should use the printed Dungeon + Denizen emblems');
        assert.deepStrictEqual(footerTokens(cardById(75)).right, ['location', 'GARRISON'],
            'Infiltration footer should use the printed Location pin with the GARRISON label');
        assert.deepStrictEqual(footerTokens(cardById(83)).left, ['veteran', '+', 'environment'],
            'The Floodgates Open footer should use the printed Veteran + Environment emblems');
        assert.deepStrictEqual(footerTokens(cardById(98)).left, ['corrupter', 'wandering-beast'],
            'Eldritch Tentacle footer should use the printed Corrupter / Wandering Beast emblems');
        assert.deepStrictEqual(footerTokens(cardById(98)).right, ['otherworldly'],
            'Eldritch Tentacle footer should use the printed Otherworldly emblem on the right');
        assert.deepStrictEqual(footerTokens(cardById(114)).left, ['cabal'],
            'The Cabal footer should use the printed Cabal emblem');
    }

    {
        const artificialLabels = new Set(['NPC Activation Rules', 'Character Rules', 'Note', 'Body', '(body)']);
        const dreadLabel = /^(?:DISQUIET|DISTRESS|DISMAY|DESPERATION|DISASTER|DOOM)(?:-(?:DISQUIET|DISTRESS|DISMAY|DESPERATION|DISASTER|DOOM))*$/;

        allCards.forEach(card => {
            (card.sections || []).forEach(section => {
                assert(!('threshold' in section),
                    `${card.card} should not render unprinted numeric section thresholds`);
                assert(!artificialLabels.has(section.label),
                    `${card.card} should not render an invented section label`);
                if (section.label && dreadLabel.test(section.label.toUpperCase())) {
                    assert(dreadLabel.test(section.label),
                        `${card.card} mode label should match printed uppercase styling: ${section.label}`);
                }
            });
        });
    }

    {
        const blaze = sectionText(cardById(43));
        assert(blaze.includes('Vicious [vicious], Quickstrike [quickstrike], and Cleave [cleave]'),
            'Blaze of Glory should use the printed Vicious, Quickstrike, and Cleave icons');
        assert(!blaze.includes('Vicious [sharp]') && !blaze.includes('Quickstrike [move]') && !blaze.includes('Cleave [melee]'),
            'Blaze of Glory should not use generic rule icons for named abilities');

        assert(sectionText(cardById(53)).includes('Hit and Run [hit-and-run]'),
            'Stand And Deliver! should use the printed Hit and Run icon');
        assert.deepStrictEqual(sectionLabels(cardById(54)), ['DISQUIET-DOOM'],
            'Bounty! should not render its title as an extra section label');
        assert(sectionText(cardById(56)).includes('gains G20.'),
            'Excursionist should render the printed G20 reward text');
        assert(sectionText(cardById(63)).includes('Potion [potion] of your choice'),
            'Stroke Of Fortune should include the printed potion icon');

        assert(sectionText(cardById(67)).includes('Poisoned [poison] counter'),
            'Toxic Waste should include the printed poisoned counter token');
        assert(sectionText(cardById(74)).includes('Adventurers may Interact'),
            'Nectar Of The Gods should preserve printed Interact capitalization');

        assert(sectionText(cardById(96)).includes('Take all [wandering-beast] cards'),
            'Home Invasion should use the printed Wandering Beast card icon');
        assert(sectionText(cardById(97)).includes('Resolve it immediately.'),
            'Unmasked! should not retain the OCR typo');
        assert.strictEqual(cardById(113).card, 'Maladite Golem',
            'Maladite Golem should use the printed card title');

        assert(sectionText(cardById(134)).includes('Sundering [sundering]'),
            'Malacytic Vigour should include the printed Sundering icon');
        assert(sectionText(cardById(135)).includes('Sundering [sundering]'),
            'Trap! Deadfall should include the printed Sundering icon');
        assert(sectionText(cardById(139)).includes('Déjà vu'),
            'Not Again? should preserve the printed accent');
        assert.strictEqual(countToken(sectionText(cardById(142)), 'wounded'), 2,
            'Trap! Caltrops should include both printed Wounded icons');

        const suddenRot = cardById(133);
        assert.strictEqual(suddenRot.extraction.status, 'verified',
            'Sudden Rot should be verified once the printed food item list is captured');
        assert(!sectionText(suddenRot).includes('[unknown-icon]'),
            'Sudden Rot should not keep unresolved placeholders after food item review');
        ['Morsel', 'Provisions', 'Remedy', 'Minerals', 'Sunblessed Weed', 'Herbs', 'Fungus'].forEach(item => {
            assert(sectionText(suddenRot).includes(item), `Sudden Rot should list ${item} as food`);
        });
    }

    console.log('All card catalog coverage tests passed!');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
