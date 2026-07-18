/**
 * Combined UI contract tests for the themed cockpit and rich card catalog.
 * Run with: node tests/uiManager.test.js
 */
const assert = require('assert');
const { loadSourceModule } = require('./helpers/load-source-module');

function makeClassList(initialClasses = []) {
    const classes = new Set(initialClasses);
    return {
        add(...values) {
            values.forEach(value => classes.add(value));
        },
        remove(...values) {
            values.forEach(value => classes.delete(value));
        },
        toggle(value, force) {
            if (force === undefined) {
                if (classes.has(value)) {
                    classes.delete(value);
                    return false;
                }
                classes.add(value);
                return true;
            }
            if (force) classes.add(value);
            else classes.delete(value);
            return Boolean(force);
        },
        contains(value) {
            return classes.has(value);
        }
    };
}

function makeElement(tagName = 'div') {
    const element = {
        tagName: String(tagName).toUpperCase(),
        children: [],
        dataset: {},
        style: {},
        attributes: {},
        classList: makeClassList(),
        className: '',
        innerHTML: '',
        _textContent: '',
        value: '',
        type: '',
        disabled: false,
        hidden: false,
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        removeChild(child) {
            const index = this.children.indexOf(child);
            if (index !== -1) this.children.splice(index, 1);
            return child;
        },
        replaceChildren(...children) {
            this.children = children;
            this.innerHTML = '';
            this._textContent = '';
        },
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        },
        getAttribute(name) {
            return this.attributes[name] ?? null;
        },
        removeAttribute(name) {
            delete this.attributes[name];
        },
        querySelector(selector) {
            return this.queries?.[selector] || null;
        },
        querySelectorAll(selector) {
            return this.queryLists?.[selector] || [];
        },
        scrollIntoView() { },
        focus() { }
    };

    Object.defineProperties(element, {
        firstChild: {
            get() {
                return this.children[0] || null;
            }
        },
        textContent: {
            get() {
                const childText = this.children.map(child => child.textContent || '').join(' ');
                return [this._textContent, childText].filter(Boolean).join(' ');
            },
            set(value) {
                this._textContent = String(value);
                this.children = [];
            }
        }
    });

    return element;
}

function makeDocument(elements = {}, selectors = {}) {
    return {
        createElement: makeElement,
        createDocumentFragment() {
            return makeElement('fragment');
        },
        getElementById(id) {
            return elements[id] || null;
        },
        querySelector(selector) {
            return selectors[selector] || null;
        },
        querySelectorAll() {
            return [];
        }
    };
}

function makeSummary() {
    return {
        gamesText: 'Base Game',
        difficultyText: 'Custom difficulty',
        remainingCount: 0,
        discardCount: 0,
        inPlayCount: 0,
        statusText: 'Ready to draw',
        showSentryBadge: false,
        showCorrupterBadge: false
    };
}

function loadUiManager(document, window = {}, stateOverrides = {}, overrides = {}) {
    const state = {
        currentDeck: [],
        currentIndex: -1,
        allCardTypes: [],
        dataStore: { sentryTypes: [], corrupterTypes: [] },
        cardCounts: {},
        specialCardCounts: {},
        availableCards: [],
        inPlayCards: [],
        discardPile: [],
        sentryDeck: [],
        setAsideCards: [],
        selectedGames: [],
        difficultySettings: [],
        selectedDifficultyIndex: 0,
        enableSentryRules: false,
        enableCorrupterRules: false,
        iconRegistry: {},
        cardMap: new Map(),
        isUtilityDrawerOpen: true,
        uiMode: 'build',
        ...stateOverrides
    };

    const helpers = loadSourceModule('ui-manager.js', {
        dependencies: {
            state,
            slugify: value => String(value).toLowerCase(),
            cardTypeId: type => `type-${String(type).toLowerCase()}`,
            parseCardTypes: () => ({ andGroups: [], allTypes: [] }),
            debounce: fn => fn,
            saveConfiguration: () => { },
            deriveDeckMode: overrides.deriveDeckMode || (({ requestedMode }) => requestedMode),
            formatDeckSummary: overrides.formatDeckSummary || makeSummary,
            getGenerateDeckState: overrides.getGenerateDeckState || (() => ({
                canGenerate: false,
                label: 'Choose Card Counts'
            })),
            searchCards: overrides.searchCards || (() => []),
            renderCardNode: overrides.renderCardNode || (() => makeElement('article')),
            renderCompactCardNode: overrides.renderCompactCardNode || (() => makeElement('article')),
            document,
            window
        },
        exports: [
            'setActionPanelOpen',
            'toggleActionPanel',
            'setDeckMode',
            'updateCardSearchResults',
            'showCardPreview',
            'renderDeckSummary'
        ]
    });

    return { ...helpers, state };
}

console.log('Testing combined UI manager contracts...');

{
    const content = Object.assign(makeElement(), { style: { height: '10px' } });
    content.classList = makeClassList(['collapse', 'collapsing']);
    const trigger = makeElement('button');
    trigger.classList = makeClassList(['collapsed']);
    const utilityTrigger = makeElement('button');
    const document = makeDocument(
        { cardActionContent: content, playUtilityActions: utilityTrigger },
        { '[data-bs-target="#cardActionContent"]': trigger }
    );
    const { setActionPanelOpen, toggleActionPanel } = loadUiManager(document);

    setActionPanelOpen(true);
    assert.strictEqual(content.classList.contains('show'), true);
    assert.strictEqual(content.classList.contains('collapsing'), false);
    assert.strictEqual(content.style.height, '');
    assert.strictEqual(trigger.attributes['aria-expanded'], 'true');
    assert.strictEqual(utilityTrigger.attributes['aria-expanded'], 'true');

    toggleActionPanel();
    assert.strictEqual(content.classList.contains('show'), false);
    assert.strictEqual(trigger.attributes['aria-expanded'], 'false');
}

{
    const elements = {
        deckExperience: makeElement(),
        deckModeEyebrow: makeElement('p'),
        deckModeTitle: makeElement('h2'),
        deckModeDescription: makeElement('p'),
        buildModeButton: makeElement('button'),
        playModeButton: makeElement('button'),
        deckUtilityDrawer: makeElement('section'),
        deckUtilityDrawerBody: makeElement('div'),
        toggleUtilityDrawer: makeElement('button'),
        generateDeck: makeElement('button')
    };
    const document = makeDocument(elements);
    const { setDeckMode } = loadUiManager(document, {}, {
        currentDeck: [{ id: 1, card: 'Alarm!' }],
        difficultySettings: [{ name: 'Custom difficulty' }]
    }, {
        getGenerateDeckState: () => ({ canGenerate: true, label: 'Rebuild Deck' })
    });

    setDeckMode('play');
    assert.strictEqual(elements.deckExperience.dataset.mode, 'play');
    assert.strictEqual(elements.deckModeEyebrow.textContent, 'Step 2 of 2');
    assert.strictEqual(elements.deckModeTitle.textContent, 'Play the live deck');
    assert(elements.deckModeDescription.textContent.includes('Search Cards'));
    assert.strictEqual(elements.playModeButton.attributes['aria-pressed'], 'true');
    assert.strictEqual(elements.buildModeButton.attributes['aria-pressed'], 'false');
}

{
    const elements = {
        generateDeck: makeElement('button'),
        'type-dungeon': Object.assign(makeElement('input'), { value: '0' }),
        'type-sentry': Object.assign(makeElement('input'), { value: '2' })
    };
    const document = makeDocument(elements);
    let lastGenerateConfig;
    const loaded = loadUiManager(document, {}, {
        allCardTypes: ['Dungeon', 'Sentry'],
        selectedGames: ['Base Game'],
        dataStore: { sentryTypes: ['Sentry'], corrupterTypes: [] },
        difficultySettings: [{ name: 'Custom difficulty' }]
    }, {
        getGenerateDeckState(config) {
            lastGenerateConfig = config;
            const canGenerate = config.cardCounts.Dungeon > 0
                || (config.enableSentryRules && config.cardCounts.Sentry > 0);
            return { canGenerate, label: canGenerate ? 'Generate Deck' : 'Choose Card Counts' };
        }
    });

    loaded.renderDeckSummary();
    assert.strictEqual(lastGenerateConfig.enableSentryRules, false);
    assert.strictEqual(elements.generateDeck.disabled, true,
        'Disabled special rules must not make the deck buildable');

    loaded.state.enableSentryRules = true;
    loaded.renderDeckSummary();
    assert.strictEqual(elements.generateDeck.disabled, false,
        'Enabling a configured deck rule should update the build contract');
    assert(elements.generateDeck.innerHTML.includes('Generate Deck'));
}

{
    const results = makeElement('div');
    results.appendChild(makeElement('div'));
    const status = makeElement('small');
    const document = makeDocument({ cardSearchResults: results, cardSearchStatus: status });
    const cards = [
        { id: 10, card: 'Alarm!', type: 'Environment', game: 'Base Game', sections: [] },
        {
            id: 11,
            card: 'Grave Matters',
            type: 'Dungeon',
            game: 'Beyond The Vaults',
            sections: [{ label: 'DISQUIET', text: 'Search the nearest grave.' }]
        }
    ];
    let searchCall;
    let compactCard;
    const { updateCardSearchResults } = loadUiManager(document, {}, { availableCards: cards }, {
        searchCards(receivedCards, query) {
            searchCall = { receivedCards, query };
            return [cards[1]];
        },
        renderCompactCardNode(card) {
            compactCard = card;
            return makeElement('article');
        }
    });

    updateCardSearchResults('  grave searched  ');
    assert.strictEqual(searchCall.receivedCards, cards,
        'Search must cover every card from the currently selected games');
    assert.strictEqual(searchCall.query, 'grave searched');
    assert.strictEqual(compactCard, cards[1]);
    assert.strictEqual(results.children.length, 1);
    assert.strictEqual(results.children[0].tagName, 'BUTTON',
        'Search results should be native keyboard-accessible controls');
    assert.strictEqual(results.children[0].type, 'button');
    assert.strictEqual(results.children[0].dataset.cardId, '11');
    assert(status.textContent.includes('1 of 1'));

    updateCardSearchResults('');
    assert.strictEqual(results.children.length, 0);
    assert.strictEqual(status.textContent, '');
}

{
    const title = makeElement('h5');
    const surface = makeElement('div');
    const type = makeElement('p');
    const readable = makeElement('div');
    const hint = makeElement('small');
    const actionButtons = [makeElement('button'), makeElement('button'), makeElement('button')];
    const modal = makeElement('div');
    modal.queries = {
        '[data-card-preview-title]': title,
        '[data-card-preview-surface]': surface,
        '[data-card-preview-type]': type,
        '[data-card-preview-readable]': readable,
        '[data-card-preview-hint]': hint
    };
    modal.queryLists = { '[data-preview-deck-action]': actionButtons };
    const shuffleInput = makeElement('input');
    const document = makeDocument({
        cardPreviewModal: modal,
        cardPreviewShuffleCount: shuffleInput
    });
    let renderedCard;
    let shownCount = 0;
    const window = {
        bootstrap: {
            Modal: {
                getOrCreateInstance() {
                    return { show() { shownCount++; } };
                }
            }
        }
    };
    const richCard = {
        id: 42,
        card: 'Alarm!',
        type: 'Environment',
        game: 'Base Game',
        renderMode: 'rich',
        sections: [{ label: 'DISQUIET', text: 'Raise the alarm.' }]
    };
    const loaded = loadUiManager(document, window, { cardMap: new Map([[42, richCard]]) }, {
        renderCardNode(card) {
            renderedCard = card;
            return makeElement('article');
        }
    });

    loaded.showCardPreview({ id: '42' });
    assert.strictEqual(renderedCard.id, richCard.id);
    assert.strictEqual(renderedCard.sections, richCard.sections,
        'The preview should preserve normalized rich sections for the shared card renderer');
    assert.strictEqual(surface.children.length, 1);
    assert.strictEqual(readable.hidden, true,
        'Rich renderer text should not be duplicated by the legacy readable panel');
    assert.strictEqual(modal.dataset.cardId, '42');
    assert.strictEqual(modal.dataset.cardGame, 'Base Game');
    assert.strictEqual(shuffleInput.disabled, true);
    assert.strictEqual(actionButtons.every(button => button.disabled), true);
    assert(hint.textContent.includes('Generate a deck'));
    assert.strictEqual(shownCount, 1);

    loaded.state.currentDeck = [{ id: 7 }];
    loaded.showCardPreview({ card: richCard });
    assert.strictEqual(shuffleInput.disabled, false);
    assert.strictEqual(actionButtons.every(button => !button.disabled), true);
    assert(hint.textContent.includes('active deck'));

    const imageCard = {
        id: 7,
        card: 'Image Card',
        type: 'Dungeon',
        renderMode: 'image',
        sourceImage: 'image-card.png',
        sections: [{ label: 'DISMAY', text: 'Draw another card.' }]
    };
    loaded.showCardPreview({ card: imageCard });
    assert.strictEqual(readable.hidden, false);
    assert(readable.textContent.includes('DISMAY'),
        'Readable image-card previews must use rich section.label headings');
    assert(readable.textContent.includes('Draw another card.'));

    loaded.showCardPreview({ card: { ...imageCard, sections: [] } });
    assert(readable.textContent.includes('Readable text unavailable'),
        'Image-only previews should retain the audit fallback copy');
}

console.log('All combined UI manager contracts passed!');
