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

    [
        { id: 65, token: 'revenant' },
        { id: 78, token: 'blue-reminder' },
        { id: 78, token: 'red-reminder' },
        { id: 78, token: 'yellow-reminder' },
        { id: 95, token: 'actions' }
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

    [65, 78, 95].forEach(id => {
        const card = cardById(id);
        const rendered = renderCardNode(card, {
            document: createDocumentStub(),
            iconRegistry: catalog.icons
        });
        assert.strictEqual(collectByClass(rendered, 'card-inline-token--unknown').length, 0,
            `${card.card} should render without unresolved token placeholders`);
    });

    console.log('All card catalog coverage tests passed!');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
