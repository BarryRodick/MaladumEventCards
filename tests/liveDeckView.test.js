/**
 * Live deck browser view tests
 * Run with: node tests/liveDeckView.test.js
 */
const assert = require('assert');
const { loadSourceModule } = require('./helpers/load-source-module');

function loadLiveDeckView(state, document, overrides = {}) {
    return loadSourceModule('live-deck-view.js', {
        dependencies: {
            state,
            renderDeckSummary: overrides.renderDeckSummary || (() => { }),
            document,
            Image: overrides.Image || function TestImage() { }
        },
        exports: ['liveDeckView']
    }).liveDeckView;
}

console.log('Testing live deck browser view...');

{
    const state = {
        currentDeck: [{ id: 1, card: 'Card A', type: 'Denizen', contents: 'a.png' }],
        currentIndex: 0,
        isActiveCardCleared: false
    };
    const clearButton = { style: {}, removed: false };
    const output = {
        child: null,
        querySelector() { return null; },
        appendChild(child) { this.child = child; },
        set innerHTML(value) {
            this._innerHTML = value;
            clearButton.removed = true;
        },
        get innerHTML() { return this._innerHTML || ''; }
    };
    const document = {
        createElement() {
            return { className: '', innerHTML: '', setAttribute() { } };
        },
        getElementById(id) {
            if (id === 'deckOutput') return output;
            if (id === 'clearActiveCard') return clearButton.removed ? null : clearButton;
            return null;
        }
    };

    loadLiveDeckView(state, document).renderCurrentCard();

    assert.strictEqual(clearButton.removed, false);
    assert(output.child.innerHTML.includes('data-active-card-preview'));
    assert(output.child.innerHTML.includes('data-card-id="1"'));
    assert(output.child.innerHTML.includes('Open Card A card preview'));
    assert.strictEqual(clearButton.style.display, 'block');
}

{
    const state = {
        currentDeck: [{ id: 1 }, { id: 2 }, { id: 3 }],
        currentIndex: 1
    };
    const progressBar = { style: {}, setAttribute(name, value) { this[name] = value; } };
    const progressText = { textContent: '' };
    let summaryCalls = 0;
    const document = {
        getElementById(id) {
            if (id === 'progressBar') return progressBar;
            if (id === 'progressText') return progressText;
            return null;
        }
    };

    loadLiveDeckView(state, document, {
        renderDeckSummary: () => { summaryCalls++; }
    }).renderProgress();

    assert.strictEqual(progressText.textContent, 'Card 2 of 3');
    assert.strictEqual(progressBar.style.width, `${(2 / 3) * 100}%`);
    assert.strictEqual(progressBar['aria-valuenow'], '67');
    assert.strictEqual(progressBar['aria-valuetext'], 'Card 2 of 3');
    assert.strictEqual(summaryCalls, 1);
}

{
    function createElement() {
        return {
            children: [],
            classList: { add() { } },
            innerHTML: '',
            appendChild(child) { this.children.push(child); }
        };
    }

    const state = {
        currentDeck: [{ id: 1 }],
        inPlayCards: [{ id: 17, card: 'Wanderer', type: 'Denizen', contents: 'wanderer.jpg' }]
    };
    const inPlayContainer = {
        innerHTML: '',
        children: [],
        appendChild(child) { this.children.push(child); }
    };
    const inPlaySection = { style: { display: 'none' } };
    const clearInPlayButton = { hidden: false, disabled: false };
    const document = {
        createElement,
        getElementById(id) {
            if (id === 'inPlayCards') return inPlayContainer;
            if (id === 'inPlaySection') return inPlaySection;
            if (id === 'clearInPlayCards') return clearInPlayButton;
            return null;
        }
    };

    loadLiveDeckView(state, document).renderInPlayCards();

    const cardHtml = inPlayContainer.children[0].children[0].innerHTML;
    assert.strictEqual(inPlaySection.style.display, 'block');
    assert(cardHtml.includes('class="in-play-card-preview"'));
    assert(cardHtml.includes('data-card-image="wanderer.png"'));
    assert(cardHtml.includes('class="btn btn-danger remove-from-play"'));
    assert.strictEqual(clearInPlayButton.hidden, false);
    assert.strictEqual(clearInPlayButton.disabled, false);
}

console.log('All live deck browser view tests passed!');
