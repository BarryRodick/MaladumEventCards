/**
 * Test suite for live deck display rendering
 * Run with: node tests/deckDisplay.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function createNode(tagName = 'div') {
    return {
        tagName: String(tagName).toUpperCase(),
        children: [],
        dataset: {},
        style: {},
        attributes: {},
        className: '',
        textContent: '',
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        replaceChildren(...children) {
            this.children = children.filter(Boolean);
        },
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        }
    };
}

function createTestDocument() {
    const elements = {
        deckOutput: createNode('section'),
        clearActiveCard: createNode('button'),
        progressBar: createNode('div'),
        progressText: createNode('div')
    };

    return {
        elements,
        createElement(tagName) {
            return createNode(tagName);
        },
        getElementById(id) {
            return elements[id] || null;
        }
    };
}

function loadDeckManager(state, document, overrides = {}) {
    const file = path.join(__dirname, '..', 'deck-manager.js');
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/import .*?\r?\n/g, '');
    code = code.replace(/export function /g, 'function ');

    const shuffleDeck = overrides.shuffleDeck || ((deck) => deck);
    const parseCardTypes = overrides.parseCardTypes || (() => ({ andGroups: [], allTypes: [] }));
    const showToast = overrides.showToast || (() => { });
    const trackEvent = overrides.trackEvent || (() => { });
    const debounce = overrides.debounce || ((fn) => fn);
    const saveConfiguration = overrides.saveConfiguration || (() => { });
    const renderDeckSummary = overrides.renderDeckSummary || (() => { });
    const setDeckMode = overrides.setDeckMode || (() => { });
    const renderCardNode = overrides.renderCardNode || (() => createNode('article'));
    const ImageCtor = overrides.Image || function Image() { this.src = ''; };

    const factory = new Function(
        'state',
        'CONFIG',
        'cardTypeId',
        'shuffleDeck',
        'parseCardTypes',
        'showToast',
        'trackEvent',
        'debounce',
        'saveConfiguration',
        'renderDeckSummary',
        'setDeckMode',
        'renderCardNode',
        'document',
        'Image',
        `${code}; return { showCurrentCard };`
    );

    return factory(
        state,
        {},
        () => '',
        shuffleDeck,
        parseCardTypes,
        showToast,
        trackEvent,
        debounce,
        saveConfiguration,
        renderDeckSummary,
        setDeckMode,
        renderCardNode,
        document,
        ImageCtor
    );
}

console.log('Testing live deck display rendering...');

{
    const document = createTestDocument();
    const state = {
        currentIndex: -1,
        currentDeck: [],
        iconRegistry: {}
    };

    const { showCurrentCard } = loadDeckManager(state, document);
    showCurrentCard();

    const output = document.elements.deckOutput;
    const clearButton = document.elements.clearActiveCard;
    const deckRoot = output.children[0];
    const readyState = deckRoot.children[0];
    const readyImage = readyState.children[0];

    assert.strictEqual(output.children.length, 2, 'Deck output should preserve the clear button alongside the rendered surface');
    assert.strictEqual(deckRoot.dataset.deckState, 'ready', 'Ready state should expose a ready deck state marker');
    assert.strictEqual(deckRoot.dataset.renderMode, 'image', 'Ready state should expose image render mode');
    assert.strictEqual(deckRoot.dataset.deckSurface, 'true', 'Ready state should expose a stable deck surface wrapper');
    assert.strictEqual(readyImage.src, 'cardimages/back.jpg', 'Ready state should continue to use the back-of-deck image');
    assert.strictEqual(clearButton.style.display, 'none', 'Clear button should stay hidden until a live card is active');
}

{
    const document = createTestDocument();
    const renderCalls = [];
    const renderedNode = createNode('article');
    renderedNode.className = 'card-surface card-surface--full';

    const state = {
        currentIndex: 0,
        currentDeck: [{
            id: 50,
            card: 'Fresh Graves',
            renderMode: 'rich'
        }],
        iconRegistry: {}
    };

    const { showCurrentCard } = loadDeckManager(state, document, {
        renderCardNode(card) {
            renderCalls.push(card);
            return renderedNode;
        }
    });

    showCurrentCard();

    const output = document.elements.deckOutput;
    const clearButton = document.elements.clearActiveCard;
    const deckRoot = output.children[0];

    assert.strictEqual(renderCalls.length, 1, 'Active cards should render through renderCardNode');
    assert.strictEqual(renderCalls[0].id, 50);
    assert.strictEqual(deckRoot.dataset.deckState, 'active', 'Active cards should expose an active deck state marker');
    assert.strictEqual(deckRoot.dataset.renderMode, 'rich', 'Rich cards should expose rich render mode on the deck wrapper');
    assert.strictEqual(deckRoot.dataset.cardId, '50', 'Deck wrapper should preserve the active card id');
    assert.strictEqual(deckRoot.children[0], renderedNode, 'Deck wrapper should contain the renderer output');
    assert.strictEqual(clearButton.style.display, 'block', 'Clear button should be visible while a live card is active');
}

{
    const document = createTestDocument();
    const renderModes = [];
    const state = {
        currentIndex: 0,
        currentDeck: [{
            id: 9,
            card: 'Alarm!',
            renderMode: 'image',
            sourceImage: 'Alarm.png'
        }],
        iconRegistry: {}
    };

    const { showCurrentCard } = loadDeckManager(state, document, {
        renderCardNode(card) {
            renderModes.push(card.renderMode);
            const node = createNode('figure');
            node.className = 'card-surface card-surface--full';
            return node;
        }
    });

    showCurrentCard();

    let output = document.elements.deckOutput;
    let clearButton = document.elements.clearActiveCard;
    let deckRoot = output.children[0];

    assert.deepStrictEqual(renderModes, ['image'], 'Legacy cards should still render through renderCardNode');
    assert.strictEqual(deckRoot.dataset.renderMode, 'image', 'Legacy cards should expose image render mode on the deck wrapper');
    assert.strictEqual(clearButton.style.display, 'block');

    state.currentIndex = -1;
    showCurrentCard();

    output = document.elements.deckOutput;
    clearButton = document.elements.clearActiveCard;
    deckRoot = output.children[0];

    assert.strictEqual(output.children[1], clearButton, 'Clear button should remain outside the rendered deck surface when state changes');
    assert.strictEqual(deckRoot.dataset.deckState, 'ready', 'Returning to ready state should swap the wrapper state marker back to ready');
    assert.strictEqual(clearButton.style.display, 'none', 'Clear button should hide again after clearing the active card');
}

console.log('All live deck display tests passed!');
