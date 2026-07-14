/**
 * Test suite for campaign tracker helpers
 * Run with: node tests/campaignTracker.test.js
 */
const assert = require('assert');
const { loadSourceModule } = require('./helpers/load-source-module');

function loadCampaignTracker() {
    return loadSourceModule('campaign-tracker.js', {
        dependencies: {
            storageUtils: {
                saveState() { },
                loadState() { return null; },
                isStorageAvailable() { return true; }
            }
        },
        exports: ['captureCampaignState', 'applyCampaignState']
    });
}

function makeClassList(initial = []) {
    const classes = new Set(initial);
    return {
        add(value) { classes.add(value); },
        remove(value) { classes.delete(value); },
        contains(value) { return classes.has(value); },
        toggle(value) {
            if (classes.has(value)) {
                classes.delete(value);
                return false;
            }
            classes.add(value);
            return true;
        }
    };
}

function makeElement() {
    return {
        style: {},
        dataset: {},
        value: '',
        className: '',
        textContent: '',
        src: '',
        children: [],
        classList: makeClassList(),
        listeners: {},
        addEventListener(event, handler) {
            this.listeners[event] = handler;
        },
        appendChild(child) {
            this.children.push(child);
        },
        querySelectorAll() {
            return [];
        },
        querySelector() {
            return null;
        },
        set innerHTML(value) {
            this.children = [];
            this._innerHTML = value;
        },
        get innerHTML() {
            return this._innerHTML || '';
        }
    };
}

function makeDocument(selectors = {}, ids = {}) {
    return {
        querySelectorAll(selector) {
            return selectors[selector] || [];
        },
        querySelector(selector) {
            return (selectors[selector] || [])[0] || null;
        },
        getElementById(id) {
            return ids[id] || null;
        },
        createElement: makeElement
    };
}

console.log('Testing campaign tracker helpers...');

{
    const { captureCampaignState } = loadCampaignTracker();
    const checkboxA = makeElement();
    checkboxA.style.backgroundColor = 'black';
    const checkboxB = makeElement();
    const delay = makeElement();
    delay.style.backgroundColor = 'black';
    const group = makeElement();
    group.querySelectorAll = () => [checkboxA, checkboxB];
    const notesContent = makeElement();
    notesContent.classList.add('visible');
    const notesTextarea = makeElement();
    notesTextarea.value = 'Session notes';
    const input = makeElement();
    input.value = '3';

    const doc = makeDocument({
        '.checkbox': [checkboxA, checkboxB],
        '.checkbox-group': [group],
        '.delay-checkbox': [delay],
        '.input-field': [input]
    });

    const state = captureCampaignState(
        doc,
        {
            checkboxSelector: '.checkbox',
            checkboxMode: 'style',
            inputSelector: '.input-field',
            checkboxGroupSelector: '.checkbox-group',
            binaryTracks: [
                { stateKey: 'delayTrack', selector: '.delay-checkbox', mode: 'style' }
            ]
        },
        { notesContent, notesTextarea },
        { images: ['data:image/png;base64,abc'] }
    );

    assert.deepStrictEqual(state.checkboxes, [true, false]);
    assert.deepStrictEqual(state.checkboxGroups, [[true, false]]);
    assert.deepStrictEqual(state.delayTrack, [true]);
    assert.deepStrictEqual(state.inputs, ['3']);
    assert.strictEqual(state.notes, 'Session notes');
    assert.strictEqual(state.notesVisible, true);
    assert.deepStrictEqual(state.images, ['data:image/png;base64,abc']);
}

{
    const { applyCampaignState } = loadCampaignTracker();
    const checkboxA = makeElement();
    const checkboxB = makeElement();
    const input = makeElement();
    const notesContent = makeElement();
    const collapseIcon = makeElement();
    const notesTextarea = makeElement();
    const imageGallery = makeElement();
    const doc = makeDocument({
        '.checkbox': [checkboxA, checkboxB],
        '.input-field': [input]
    });

    applyCampaignState(
        doc,
        {
            checkboxSelector: '.checkbox',
            checkboxMode: 'dataset',
            checkboxActiveColor: '#333',
            inputSelector: '.input-field',
            binaryTracks: []
        },
        { notesContent, collapseIcon, notesTextarea, imageGallery },
        { images: [] },
        {
            checkboxes: [true, false],
            inputs: ['7'],
            notes: 'Recovered',
            notesVisible: true,
            images: ['data:image/png;base64,def']
        }
    );

    assert.strictEqual(checkboxA.dataset.checked, 'true');
    assert.strictEqual(checkboxA.style.backgroundColor, '#333');
    assert.strictEqual(checkboxB.dataset.checked, '');
    assert.strictEqual(input.value, '7');
    assert.strictEqual(notesTextarea.value, 'Recovered');
    assert.strictEqual(notesContent.classList.contains('visible'), true);
    assert.strictEqual(collapseIcon.classList.contains('rotated'), true);
    assert.strictEqual(imageGallery.children.length, 1);
}

console.log('All campaign tracker helper tests passed!');
