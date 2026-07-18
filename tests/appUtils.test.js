/**
 * Test suite for app utility helpers
 * Run with: node tests/appUtils.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function loadTrackEvent(gtag) {
    const file = path.join(__dirname, '..', 'app-utils.js');
    const code = fs.readFileSync(file, 'utf8');
    const match = code.match(/export function trackEvent\(eventCategory, eventAction, eventLabel = null, eventValue = null\) \{[\s\S]*?\n\}/);
    if (!match) throw new Error('trackEvent function not found');

    return new Function(
        'gtag',
        `${match[0].replace('export ', '')}; return trackEvent;`
    )(gtag);
}

function loadShowToast() {
    const file = path.join(__dirname, '..', 'app-utils.js');
    const code = fs.readFileSync(file, 'utf8');
    const match = code.match(/export function showToast\(message\) \{[\s\S]*?\n\}/);
    if (!match) throw new Error('showToast function not found');

    return new Function(
        `${match[0].replace('export ', '')}; return showToast;`
    )();
}

console.log('Testing app utility helpers...');

{
    const calls = [];
    const trackEvent = loadTrackEvent((...args) => calls.push(args));

    trackEvent('Deck', 'Generate', null, null);

    assert.deepStrictEqual(calls, [[
        'event',
        'Generate',
        {
            event_category: 'Deck'
        }
    ]], 'trackEvent should omit null analytics fields');
}

{
    const calls = [];
    const trackEvent = loadTrackEvent((...args) => calls.push(args));

    trackEvent('Deck', 'Generate', 'Base Game', 12);

    assert.deepStrictEqual(calls, [[
        'event',
        'Generate',
        {
            event_category: 'Deck',
            event_label: 'Base Game',
            value: 12
        }
    ]], 'trackEvent should include provided analytics fields');
}

assert.doesNotThrow(() => {
    const trackEvent = loadTrackEvent(undefined);
    trackEvent('App', 'Initialize');
}, 'trackEvent should be safe when Google Analytics is unavailable');

{
    const createdNodes = [];
    const createNode = (tagName) => ({
        tagName: tagName.toUpperCase(),
        children: [],
        attributes: {},
        className: '',
        textContent: '',
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        append(...children) {
            this.children.push(...children);
        },
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        },
        addEventListener() { },
        remove() { }
    });
    const toastContainer = createNode('div');
    const previousDocument = global.document;
    const previousBootstrap = global.bootstrap;

    global.document = {
        getElementById(id) {
            return id === 'toastContainer' ? toastContainer : null;
        },
        createElement(tagName) {
            const node = createNode(tagName);
            createdNodes.push(node);
            return node;
        }
    };
    global.bootstrap = {
        Toast: class {
            show() { }
        }
    };

    try {
        loadShowToast()('<img src=x onerror=alert(1)>');
    } finally {
        global.document = previousDocument;
        global.bootstrap = previousBootstrap;
    }

    const toastElement = toastContainer.children[0];
    const messageNode = createdNodes.find(node => node.className === 'feedback-toast__message');
    assert(toastElement.className.includes('feedback-toast'),
        'Toast markup should use the shared themed feedback surface');
    assert(createdNodes.some(node => node.className === 'feedback-toast__title'),
        'Toast markup should expose a themed notice heading');
    assert.strictEqual(messageNode.textContent, '<img src=x onerror=alert(1)>',
        'Toast messages should remain literal text instead of being parsed as HTML');
    assert(!toastElement.className.includes('bg-dark') && !toastElement.className.includes('text-white'),
        'Toast markup should not use generic Bootstrap dark utility classes');
}

console.log('All app utility helper tests passed!');
