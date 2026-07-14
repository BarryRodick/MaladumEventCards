/**
 * Test suite for UI manager helpers
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
            if (force) {
                classes.add(value);
            } else {
                classes.delete(value);
            }
            return !!force;
        },
        contains(value) {
            return classes.has(value);
        }
    };
}

function loadUiHelpers(document, window = {}, stateOverrides = {}) {
    return loadSourceModule('ui-manager.js', {
        dependencies: {
            state: {
                currentDeck: [],
                allCardTypes: [],
                dataStore: { sentryTypes: [], corrupterTypes: [] },
                cardCounts: {},
                specialCardCounts: {},
                availableCards: [],
                inPlayCards: [],
                discardPile: [],
                selectedGames: [],
                difficultySettings: [],
                selectedDifficultyIndex: 0,
                ...stateOverrides
            },
            slugify: text => text,
            cardTypeId: type => type,
            parseCardTypes: () => ({ allTypes: [] }),
            debounce: fn => fn,
            saveConfiguration: () => { },
            deriveDeckMode: () => 'build',
            formatDeckSummary: () => ({}),
            document,
            window
        },
        exports: ['setActionPanelOpen', 'toggleActionPanel', 'showCardPreview', 'renderDeckSummary']
    });
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function makeElement(tagName = 'div') {
    return {
        tagName: tagName.toUpperCase(),
        children: [],
        dataset: {},
        style: {},
        attributes: {},
        classList: makeClassList(),
        innerHTML: '',
        _textContent: '',
        src: '',
        alt: '',
        disabled: false,
        appendChild(child) {
            this.children.push(child);
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
        removeAttribute(name) {
            delete this.attributes[name];
        },
        querySelector(selector) {
            return this.queries?.[selector] || null;
        },
        querySelectorAll(selector) {
            return this.queryLists?.[selector] || [];
        },
        set textContent(value) {
            this._textContent = String(value);
            this.innerHTML = escapeHtml(value);
        },
        get textContent() {
            const childText = this.children.map(child => child.textContent || '').join(' ');
            return [this._textContent, childText].filter(Boolean).join(' ');
        }
    };
}

console.log('Testing UI manager helpers...');

{
    const content = {
        classList: makeClassList(['collapse', 'collapsing']),
        style: { height: '10px' }
    };
    const trigger = {
        classList: makeClassList(['collapsed']),
        attributes: {},
        setAttribute(name, value) {
            this.attributes[name] = value;
        }
    };
    const document = {
        getElementById(id) {
            return id === 'cardActionContent' ? content : null;
        },
        querySelector(selector) {
            return selector === '[data-bs-target="#cardActionContent"]' ? trigger : null;
        }
    };

    const { setActionPanelOpen } = loadUiHelpers(document);
    setActionPanelOpen(true);

    assert.strictEqual(content.classList.contains('collapse'), true);
    assert.strictEqual(content.classList.contains('show'), true,
        'Opening the action panel should add the show class');
    assert.strictEqual(content.classList.contains('collapsing'), false,
        'Opening the action panel should clear transient Bootstrap classes');
    assert.strictEqual(content.style.height, '',
        'Opening the action panel should clear stale inline transition height');
    assert.strictEqual(trigger.classList.contains('collapsed'), false,
        'Opening the action panel should mark the trigger as expanded');
    assert.strictEqual(trigger.attributes['aria-expanded'], 'true');
}

{
    const content = {
        classList: makeClassList(['collapse', 'show', 'collapsing']),
        style: { height: '20px' }
    };
    const trigger = {
        classList: makeClassList([]),
        attributes: {},
        setAttribute(name, value) {
            this.attributes[name] = value;
        }
    };
    const document = {
        getElementById(id) {
            return id === 'cardActionContent' ? content : null;
        },
        querySelector(selector) {
            return selector === '[data-bs-target="#cardActionContent"]' ? trigger : null;
        }
    };

    const { setActionPanelOpen } = loadUiHelpers(document);
    setActionPanelOpen(false);

    assert.strictEqual(content.classList.contains('collapse'), true);
    assert.strictEqual(content.classList.contains('show'), false,
        'Closing the action panel should remove the show class');
    assert.strictEqual(content.classList.contains('collapsing'), false,
        'Closing the action panel should clear transient Bootstrap classes');
    assert.strictEqual(content.style.height, '',
        'Closing the action panel should clear stale inline transition height');
    assert.strictEqual(trigger.classList.contains('collapsed'), true,
        'Closing the action panel should mark the trigger as collapsed');
    assert.strictEqual(trigger.attributes['aria-expanded'], 'false');
}

{
    const content = {
        classList: makeClassList(['collapse']),
        style: {}
    };
    const trigger = {
        classList: makeClassList(['collapsed']),
        attributes: {},
        setAttribute(name, value) {
            this.attributes[name] = value;
        }
    };
    const document = {
        getElementById(id) {
            return id === 'cardActionContent' ? content : null;
        },
        querySelector(selector) {
            return selector === '[data-bs-target="#cardActionContent"]' ? trigger : null;
        }
    };

    const { toggleActionPanel } = loadUiHelpers(document);
    toggleActionPanel();

    assert.strictEqual(content.classList.contains('show'), true,
        'toggleActionPanel should open a closed panel');
}

{
    const title = makeElement('h5');
    const image = makeElement('img');
    const type = makeElement('p');
    const readable = makeElement('div');
    const modal = makeElement('div');
    modal.queries = {
        '[data-card-preview-title]': title,
        '[data-card-preview-image]': image,
        '[data-card-preview-type]': type,
        '[data-card-preview-readable]': readable,
        '[data-card-preview-hint]': makeElement('small')
    };
    modal.queryLists = {
        '[data-preview-deck-action]': [makeElement('button')]
    };
    const shuffleCount = makeElement('input');
    const document = {
        createElement: makeElement,
        getElementById(id) {
            if (id === 'cardPreviewModal') return modal;
            if (id === 'cardPreviewShuffleCount') return shuffleCount;
            return null;
        },
        querySelector() {
            return null;
        }
    };
    const { showCardPreview } = loadUiHelpers(document, {}, {
        currentDeck: [{ id: 99, card: 'Deck Card' }],
        cardMap: new Map([
            [42, {
                id: 42,
                card: 'Readable Card',
                type: 'Denizen',
                contents: 'readable.png',
                sections: [
                    {
                        header: 'DOOM',
                        threshold: 2,
                        text: 'Trap springs.\n\nDraw a treasure.'
                    }
                ]
            }]
        ])
    });

    showCardPreview({ id: '42', name: 'Old Name', image: 'old.png', type: 'Old Type' });

    assert.strictEqual(title.textContent, 'Readable Card');
    assert.strictEqual(image.src, 'cardimages/readable.png');
    assert.strictEqual(type.textContent, 'Type: Denizen');
    assert(readable.textContent.includes('DOOM'),
        'Card preview modal should render section headers from card data');
    assert(readable.textContent.includes('Trap springs.'),
        'Card preview modal should render readable section text');
}

{
    const readable = makeElement('div');
    const modal = makeElement('div');
    modal.queries = {
        '[data-card-preview-title]': makeElement('h5'),
        '[data-card-preview-image]': makeElement('img'),
        '[data-card-preview-type]': makeElement('p'),
        '[data-card-preview-readable]': readable,
        '[data-card-preview-hint]': makeElement('small')
    };
    modal.queryLists = {
        '[data-preview-deck-action]': []
    };
    const document = {
        createElement: makeElement,
        getElementById(id) {
            return id === 'cardPreviewModal' ? modal : null;
        },
        querySelector() {
            return null;
        }
    };
    const { showCardPreview } = loadUiHelpers(document, {}, {
        cardMap: new Map([
            [7, {
                id: 7,
                card: 'Image Only',
                type: 'Dungeon',
                contents: 'image-only.png',
                sections: []
            }]
        ])
    });

    showCardPreview({ id: '7', name: 'Image Only', image: 'image-only.png', type: 'Dungeon' });

    assert(readable.textContent.includes('Readable text unavailable'),
        'Card preview modal should show an image-only fallback when no usable sections exist');
}

console.log('All UI manager helper tests passed!');
