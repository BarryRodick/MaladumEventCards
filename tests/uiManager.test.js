/**
 * Test suite for UI manager helpers
 * Run with: node tests/uiManager.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

function loadUiHelpers(document, window = {}) {
    const file = path.join(__dirname, '..', 'ui-manager.js');
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/import .*?\r?\n/g, '');
    code = code.replace(/export function /g, 'function ');

    return new Function(
        'state',
        'slugify',
        'cardTypeId',
        'parseCardTypes',
        'debounce',
        'saveConfiguration',
        'deriveDeckMode',
        'formatDeckSummary',
        'document',
        'window',
        `${code}; return { setActionPanelOpen, toggleActionPanel };`
    )(
        {
            currentDeck: [],
            allCardTypes: [],
            dataStore: { sentryTypes: [], corrupterTypes: [] },
            cardCounts: {},
            specialCardCounts: {}
        },
        (text) => text,
        (type) => type,
        () => ({ allTypes: [] }),
        (fn) => fn,
        () => { },
        () => 'build',
        () => ({}),
        document,
        window
    );
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

console.log('All UI manager helper tests passed!');
