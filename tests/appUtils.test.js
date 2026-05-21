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

console.log('All app utility helper tests passed!');
