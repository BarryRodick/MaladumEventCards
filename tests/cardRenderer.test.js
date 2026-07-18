/**
 * Test suite for card renderer DOM output
 * Run with: node tests/cardRenderer.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadModule(relativePath) {
    return import(pathToFileURL(path.join(__dirname, '..', relativePath)).href);
}

function createNode(tagName = 'div', nodeType = 1, value = '') {
    const node = {
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
        removeChild(child) {
            const index = this.children.indexOf(child);
            if (index !== -1) {
                this.children.splice(index, 1);
            }
            return child;
        },
        setAttribute(name, attributeValue) {
            this.attributes[name] = String(attributeValue);
        }
    };

    Object.defineProperty(node, 'firstChild', {
        enumerable: true,
        get() {
            return this.children[0] || null;
        }
    });

    return node;
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

(async () => {
    const {
        renderCardNode,
        renderCompactCardNode
    } = await loadModule('card-renderer.mjs');

    console.log('Testing card renderer output...');

    const card = {
        id: 70,
        card: 'Heigh-Ho, Heigh-Ho!',
        type: 'Dungeon + Denizen',
        game: 'Beyond The Vaults',
        renderMode: 'rich',
        sections: [{
            kind: 'mode',
            label: 'DISQUIET-DISMAY',
            text: 'Marked rooms gain [move:2].'
        }],
        footer: {
            left: [
                { type: 'icon', name: 'larger-area' },
                { type: 'label', text: '+' },
                { type: 'icon', name: 'denizen' }
            ],
            right: [
                { type: 'icon', name: 'map' },
                { type: 'label', text: 'MINES' }
            ]
        }
    };

    const iconRegistry = {
        'larger-area': { asset: 'assets/icons/larger-area.png', kind: 'footer' },
        denizen: { asset: 'assets/icons/denizen.png', kind: 'inline' },
        map: { asset: 'assets/icons/map.png', kind: 'footer' },
        move: { asset: 'assets/icons/move.svg', kind: 'inline' }
    };

    const fullDocument = createDocumentStub();
    const fullNode = renderCardNode(card, {
        document: fullDocument,
        iconRegistry
    });

    assert.strictEqual(collectByClass(fullNode, 'card-surface__meta').length, 1,
        'Full cards should include metadata pills');
    assert.strictEqual(collectByClass(fullNode, 'card-section').length, 1,
        'Full cards should include rendered body sections');
    assert.strictEqual(collectByClass(fullNode, 'card-footer-icon').length, 3,
        'Full cards should render all footer icons');
    assert.strictEqual(collectByClass(fullNode, 'card-footer-label').length, 2,
        'Full cards should preserve footer labels');

    const compactDocument = createDocumentStub();
    const compactNode = renderCompactCardNode(card, {
        document: compactDocument,
        iconRegistry
    });

    assert.strictEqual(collectByClass(compactNode, 'card-surface__meta').length, 0,
        'Compact cards should omit metadata');
    assert.strictEqual(collectByClass(compactNode, 'card-section').length, 0,
        'Compact cards should omit body sections');
    assert.strictEqual(collectByClass(compactNode, 'card-surface__footer').length, 1,
        'Compact cards should retain a footer');
    assert.strictEqual(collectByClass(compactNode, 'card-footer-icon').length, 3,
        'Compact cards should preserve footer icons');
    assert.strictEqual(collectByClass(compactNode, 'card-footer-label').length, 0,
        'Compact cards should suppress footer labels');

    console.log('All card renderer tests passed!');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
