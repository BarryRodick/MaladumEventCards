/**
 * Test suite for ui-manager shell state updates
 * Run with: node tests/uiManager.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function createNode(tagName = 'div') {
    const node = {
        tagName: String(tagName).toUpperCase(),
        children: [],
        dataset: {},
        style: {},
        attributes: {},
        className: '',
        innerHTML: '',
        textContent: '',
        value: '',
        disabled: false,
        hidden: false,
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
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        },
        getAttribute(name) {
            return this.attributes[name] || null;
        },
        querySelector() {
            return null;
        },
        querySelectorAll() {
            return [];
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

function createDocument(elements = {}) {
    return {
        createElement(tagName) {
            return createNode(tagName);
        },
        createDocumentFragment() {
            return createNode('fragment');
        },
        getElementById(id) {
            return elements[id] || null;
        },
        querySelector() {
            return null;
        }
    };
}

function loadDeckFlowUtils() {
    const file = path.join(__dirname, '..', 'deck-flow-utils.js');
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/export function /g, 'function ');

    return new Function(`${code}; return { deriveDeckMode, formatDeckSummary, getGenerateDeckState };`)();
}

function loadUiManager(state, document, windowObject, overrides = {}) {
    const file = path.join(__dirname, '..', 'ui-manager.js');
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/import .*?\r?\n/g, '');
    code = code.replace(/export function /g, 'function ');

    const {
        deriveDeckMode = () => 'build',
        formatDeckSummary = () => ({
            gamesText: '',
            difficultyText: '',
            remainingCount: 0,
            discardCount: 0,
            statusText: 'Ready to draw',
            showSentryBadge: false,
            showCorrupterBadge: false
        }),
        getGenerateDeckState = () => ({ canGenerate: false, label: 'Choose Card Counts' })
    } = overrides.deckFlowUtils || loadDeckFlowUtils();

    const factory = new Function(
        'state',
        'slugify',
        'cardTypeId',
        'parseCardTypes',
        'debounce',
        'saveConfiguration',
        'deriveDeckMode',
        'formatDeckSummary',
        'getGenerateDeckState',
        'searchCards',
        'renderCardNode',
        'renderCompactCardNode',
        'document',
        'window',
        `${code}; return { updateCardSearchResults, showCardPreview, updateGenerateButtonState };`
    );

    return factory(
        state,
        (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        (type) => `type-${String(type).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
        overrides.parseCardTypes || (() => ({ andGroups: [], allTypes: [] })),
        overrides.debounce || ((fn) => fn),
        overrides.saveConfiguration || (() => { }),
        deriveDeckMode,
        formatDeckSummary,
        getGenerateDeckState,
        overrides.searchCards || (() => []),
        overrides.renderCardNode || (() => createNode('article')),
        overrides.renderCompactCardNode || (() => createNode('article')),
        document,
        windowObject
    );
}

console.log('Testing ui-manager shell state...');

{
    const elements = {
        generateDeck: createNode('button'),
        'type-dungeon': Object.assign(createNode('input'), { value: '0' }),
        'type-sentry': Object.assign(createNode('input'), { value: '2' })
    };
    const document = createDocument(elements);
    const state = {
        allCardTypes: ['Dungeon', 'Sentry'],
        selectedGames: ['Base Game'],
        currentDeck: [],
        dataStore: {
            sentryTypes: ['Sentry'],
            corrupterTypes: []
        },
        enableSentryRules: false,
        enableCorrupterRules: false,
        iconRegistry: {}
    };

    const { updateGenerateButtonState } = loadUiManager(state, document, {});

    updateGenerateButtonState();
    assert.strictEqual(elements.generateDeck.disabled, true,
        'Generate button should stay disabled when only disabled-rule counts are configured');
    assert.ok(elements.generateDeck.innerHTML.includes('Choose Card Counts'));

    elements['type-dungeon'].value = '1';
    updateGenerateButtonState();
    assert.strictEqual(elements.generateDeck.disabled, false,
        'Generate button should enable once a valid regular card count is configured');
    assert.ok(elements.generateDeck.innerHTML.includes('Generate Deck'));

    state.currentDeck = [{ id: 1 }];
    updateGenerateButtonState();
    assert.ok(elements.generateDeck.innerHTML.includes('Rebuild Deck'),
        'Generate button should switch to rebuild copy when an active deck exists');
}

{
    const results = createNode('div');
    results.appendChild(createNode('div'));

    const status = createNode('small');
    status.textContent = 'Old status';

    const document = createDocument({
        cardSearchResults: results,
        cardSearchStatus: status
    });
    const state = {
        iconRegistry: {},
        availableCards: []
    };

    const { updateCardSearchResults } = loadUiManager(state, document, {});
    updateCardSearchResults('');

    assert.strictEqual(status.textContent, '',
        'Empty searches should rely on the input placeholder instead of helper copy');
    assert.strictEqual(results.children.length, 0,
        'Empty searches should clear stale search results');
}

{
    const title = createNode('h5');
    const surface = createNode('div');
    const type = createNode('p');
    const shuffleInput = Object.assign(createNode('input'), { value: '6' });
    const actionButtons = [createNode('button'), createNode('button'), createNode('button')];
    let shownCount = 0;

    const modal = createNode('div');
    modal.querySelector = (selector) => {
        if (selector === '[data-card-preview-title]') return title;
        if (selector === '[data-card-preview-surface]') return surface;
        if (selector === '[data-card-preview-type]') return type;
        return null;
    };
    modal.querySelectorAll = (selector) => {
        if (selector === '[data-preview-deck-action]') {
            return actionButtons;
        }
        return [];
    };

    const document = createDocument({
        cardPreviewModal: modal,
        cardPreviewShuffleCount: shuffleInput
    });
    const state = {
        currentDeck: [],
        cardMap: new Map(),
        iconRegistry: {}
    };
    const renderedCard = createNode('article');
    const windowObject = {
        bootstrap: {
            Modal: {
                getOrCreateInstance() {
                    return {
                        show() {
                            shownCount++;
                        }
                    };
                }
            }
        }
    };

    const { showCardPreview } = loadUiManager(state, document, windowObject, {
        renderCardNode: () => renderedCard
    });

    const card = {
        id: 42,
        card: 'Alarm!',
        type: 'Environment',
        game: 'Base Game'
    };

    showCardPreview({ card });

    assert.strictEqual(title.textContent, 'Alarm!');
    assert.strictEqual(type.textContent, 'Environment • Base Game');
    assert.strictEqual(surface.children.length, 1,
        'Preview should render the card surface without any helper-copy dependency');
    assert.strictEqual(shuffleInput.disabled, true,
        'Preview actions should disable while no active deck exists');
    assert.strictEqual(actionButtons.every((button) => button.disabled), true);
    assert.strictEqual(shownCount, 1);

    state.currentDeck = [{ id: 7 }];
    showCardPreview({ card });

    assert.strictEqual(surface.children.length, 1,
        'Preview surface should be replaced cleanly on repeated renders');
    assert.strictEqual(shuffleInput.disabled, false,
        'Preview actions should enable when an active deck exists');
    assert.strictEqual(actionButtons.every((button) => button.disabled === false), true);
    assert.strictEqual(shownCount, 2);
}

console.log('All ui-manager shell tests passed!');
