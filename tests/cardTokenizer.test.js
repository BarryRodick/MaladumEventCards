/**
 * Test suite for token parsing and rendering
 * Run with: node tests/cardTokenizer.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadModule(relativePath) {
    return import(pathToFileURL(path.join(__dirname, '..', relativePath)).href);
}

function createDocumentStub() {
    const createNode = (type, value = '') => ({
        nodeType: type,
        children: [],
        attributes: {},
        dataset: {},
        className: '',
        textContent: value,
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        setAttribute(name, attributeValue) {
            this.attributes[name] = attributeValue;
        }
    });

    return {
        createDocumentFragment() {
            return createNode(11);
        },
        createTextNode(text) {
            return createNode(3, text);
        },
        createElement(tagName) {
            const node = createNode(1);
            node.tagName = tagName.toUpperCase();
            node.src = '';
            node.alt = '';
            return node;
        }
    };
}

(async () => {
    const {
        normalizeTokenSyntax,
        resolveIconEntry,
        tokenizeCardText,
        renderTokenizedText,
        tokenizedTextToPlainText
    } = await loadModule('card-tokenizer.mjs');

    console.log('Testing card token parsing...');

    assert.strictEqual(normalizeTokenSyntax('Take 2 [icon:fire] damage.'), 'Take 2 [fire] damage.');

    const parts = tokenizeCardText('Move [move:3].');
    assert.deepStrictEqual(parts, [
        { kind: 'text', text: 'Move ' },
        { kind: 'icon', raw: '[move:3]', name: 'move', value: '3', canonical: '[move:3]' },
        { kind: 'text', text: '.' }
    ]);

    assert.strictEqual(tokenizedTextToPlainText('Discard on a [skull].'), 'Discard on a skull .');
    assert.strictEqual(
        resolveIconEntry({
            'blue-reminder': { asset: 'assets/icons/blue-reminder.svg' }
        }, 'blue_reminder').asset,
        'assets/icons/blue-reminder.svg',
        'Token resolution should normalize underscores and spaces to canonical hyphenated names'
    );

    const document = createDocumentStub();
    const fragment = renderTokenizedText('Take 2 [fire] damage.', {
        document,
        iconRegistry: {
            fire: {
                asset: 'assets/icons/fire.svg'
            }
        }
    });

    assert.strictEqual(fragment.children.length, 3, 'Rendered fragment should preserve inline order');
    assert.strictEqual(fragment.children[1].tagName, 'SPAN', 'Tokenized icon should render as an inline span');
    assert.strictEqual(fragment.children[1].children[0].tagName, 'IMG', 'Icon span should contain an image node');

    console.log('All card tokenizer tests passed!');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
