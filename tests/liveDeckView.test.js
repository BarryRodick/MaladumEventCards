/**
 * Live deck browser view tests
 * Run with: node tests/liveDeckView.test.js
 */
const assert = require('assert');
const { loadSourceModule } = require('./helpers/load-source-module');

function dataAttributeToProperty(name) {
    return name
        .slice(5)
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function createNode(tagName = 'div') {
    const node = {
        tagName: String(tagName).toUpperCase(),
        children: [],
        attributes: {},
        dataset: {},
        style: {},
        className: '',
        textContent: '',
        hidden: false,
        disabled: false,
        appendChild(child) {
            this.children.push(child);
            child.parentNode = this;
            return child;
        },
        removeChild(child) {
            const index = this.children.indexOf(child);
            if (index !== -1) this.children.splice(index, 1);
            return child;
        },
        setAttribute(name, value) {
            this.attributes[name] = String(value);
            if (name.startsWith('data-')) {
                this.dataset[dataAttributeToProperty(name)] = String(value);
            }
        },
        querySelector(selector) {
            if (selector === '[data-deck-card-display]') {
                return this.children.find(child => Object.prototype.hasOwnProperty.call(
                    child.attributes,
                    'data-deck-card-display'
                )) || null;
            }
            return null;
        }
    };

    node.classList = {
        add(...classes) {
            node.className = [...new Set([
                ...node.className.split(/\s+/).filter(Boolean),
                ...classes
            ])].join(' ');
        }
    };

    Object.defineProperty(node, 'firstChild', {
        get() {
            return this.children[0] || null;
        }
    });

    Object.defineProperty(node, 'innerHTML', {
        get() {
            return '';
        },
        set() {
            throw new Error('Live deck rendering must not write HTML strings');
        }
    });

    return node;
}

function createDocument(elements = {}) {
    return {
        createElement: tagName => createNode(tagName),
        getElementById(id) {
            return elements[id] || null;
        }
    };
}

function loadLiveDeckView(state, document, overrides = {}) {
    const renderCalls = overrides.renderCalls || [];
    const createRenderedNode = (card, options, mode) => {
        renderCalls.push({ card, options, mode });
        const node = document.createElement(mode === 'full' ? 'article' : 'figure');
        node.className = `rendered-card rendered-card--${mode}`;
        node.textContent = card?.card || '';
        return node;
    };

    return loadSourceModule('live-deck-view.js', {
        dependencies: {
            state,
            renderDeckSummary: overrides.renderDeckSummary || (() => { }),
            renderCardNode: overrides.renderCardNode || ((card, options) => createRenderedNode(card, options, 'full')),
            renderCompactCardNode: overrides.renderCompactCardNode || ((card, options) => createRenderedNode(card, options, 'compact')),
            document,
            Image: overrides.Image || function TestImage() { }
        },
        exports: ['liveDeckView']
    }).liveDeckView;
}

console.log('Testing live deck browser view...');

{
    const iconRegistry = { skull: { asset: 'assets/icons/skull.svg' } };
    const richCard = {
        id: 1,
        card: '<img src=x onerror=alert(1)>',
        type: 'Veteran',
        contents: 'Sudden_Rot.png',
        renderMode: 'rich'
    };
    const state = {
        currentDeck: [richCard],
        currentIndex: 0,
        isActiveCardCleared: false,
        iconRegistry
    };
    const output = createNode('div');
    const clearButton = createNode('button');
    const document = createDocument({
        deckOutput: output,
        clearActiveCard: clearButton
    });
    const renderCalls = [];

    loadLiveDeckView(state, document, { renderCalls }).renderCurrentCard();

    const display = output.children[0];
    const preview = display.children[0];
    assert.strictEqual(preview.tagName, 'BUTTON', 'The active preview should remain a semantic button');
    assert.strictEqual(preview.dataset.activeCardPreview, '');
    assert.strictEqual(preview.dataset.cardId, '1');
    assert.strictEqual(preview.dataset.cardImage, 'Sudden_Rot.png');
    assert.strictEqual(preview.dataset.cardName, richCard.card,
        'Untrusted card text should stay data, not become parsed markup');
    assert.strictEqual(preview.attributes['aria-label'], `Open ${richCard.card} card preview`);
    assert.strictEqual(preview.children[0].className, 'rendered-card rendered-card--full');
    assert.strictEqual(renderCalls.length, 1);
    assert.strictEqual(renderCalls[0].card, richCard);
    assert.strictEqual(renderCalls[0].options.iconRegistry, iconRegistry,
        'Active rich rendering should receive the shared icon registry');
    assert.strictEqual(clearButton.style.display, 'block');
}

{
    const state = {
        currentDeck: [{ id: 1 }, { id: 2 }, { id: 3 }],
        currentIndex: 1
    };
    const progressBar = createNode('div');
    const progressText = createNode('span');
    let summaryCalls = 0;
    const document = createDocument({ progressBar, progressText });

    loadLiveDeckView(state, document, {
        renderDeckSummary: () => { summaryCalls++; }
    }).renderProgress();

    assert.strictEqual(progressText.textContent, 'Card 2 of 3');
    assert.strictEqual(progressBar.style.width, `${(2 / 3) * 100}%`);
    assert.strictEqual(progressBar.attributes['aria-valuenow'], '67');
    assert.strictEqual(progressBar.attributes['aria-valuetext'], 'Card 2 of 3');
    assert.strictEqual(summaryCalls, 1);
}

{
    const richCard = {
        id: 17,
        card: 'Sudden Rot',
        type: 'Veteran',
        contents: 'Sudden_Rot.png',
        renderMode: 'rich'
    };
    const imageCard = {
        id: 18,
        card: 'Wanderer',
        type: 'Denizen',
        contents: 'wanderer.jpg',
        renderMode: 'image'
    };
    const iconRegistry = { skull: { asset: 'assets/icons/skull.svg' } };
    const state = {
        currentDeck: [richCard],
        inPlayCards: [richCard, imageCard],
        iconRegistry
    };
    const inPlayContainer = createNode('div');
    const inPlaySection = createNode('section');
    inPlaySection.style.display = 'none';
    const clearInPlayButton = createNode('button');
    const document = createDocument({
        inPlayCards: inPlayContainer,
        inPlaySection,
        clearInPlayCards: clearInPlayButton
    });
    const renderCalls = [];

    loadLiveDeckView(state, document, { renderCalls }).renderInPlayCards();

    const richBody = inPlayContainer.children[0].children[0];
    const richPreview = richBody.children[1];
    const imageBody = inPlayContainer.children[1].children[0];
    const imagePreview = imageBody.children[1];
    const removeButton = richBody.children[2];
    assert.strictEqual(inPlaySection.style.display, 'block');
    assert.strictEqual(richPreview.tagName, 'BUTTON');
    assert.strictEqual(richPreview.className, 'in-play-card-preview');
    assert.strictEqual(richPreview.children[0].className, 'rendered-card rendered-card--compact');
    assert.strictEqual(imagePreview.dataset.cardImage, 'wanderer.png',
        'Legacy in-play preview image normalization should remain unchanged');
    assert.strictEqual(removeButton.className, 'btn btn-danger remove-from-play');
    assert.strictEqual(removeButton.dataset.id, '17');
    assert.deepStrictEqual(renderCalls.map(call => call.card), [richCard, imageCard]);
    assert(renderCalls.every(call => call.options.iconRegistry === iconRegistry));
    assert.strictEqual(clearInPlayButton.hidden, false);
    assert.strictEqual(clearInPlayButton.disabled, false);
}

console.log('All live deck browser view tests passed!');
