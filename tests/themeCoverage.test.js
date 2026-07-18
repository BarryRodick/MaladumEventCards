/**
 * Source-level checks for shared Maladum theme coverage
 * Run with: node tests/themeCoverage.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

function read(file) {
    return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

function ruleBodies(styles, selector) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [...styles.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'g'))]
        .map(match => match[1]);
}

function lastRuleBody(styles, selector) {
    const bodies = ruleBodies(styles, selector);
    return bodies.length > 0 ? bodies[bodies.length - 1] : '';
}

console.log('Testing shared theme coverage...');

{
    const aboutHtml = read('about.html');

    assert(/<body class="[^"]*\babout-page\b[^"]*">/.test(aboutHtml),
        'About should use the shared themed page scope');
    assert(aboutHtml.includes('<main id="main-content"'),
        'About should expose a semantic main content target');
    assert(aboutHtml.includes('class="about-panel"'),
        'About content should render on themed panels');
    assert(!aboutHtml.includes('card bg-dark text-white'),
        'About should not fall back to the generic Bootstrap dark card');
    assert(!aboutHtml.includes('btn btn-info'),
        'About update controls should not use the stock Bootstrap info button');
}

{
    const indexHtml = read('index.html');
    const styles = read('styles.css');
    const labelRule = lastRuleBody(styles, '.card-type-label');
    const selectRule = lastRuleBody(
        styles,
        '.deck-page #scenarioConfig select.form-control.themed-select'
    );

    assert(labelRule.includes('white-space: normal'),
        'Card type labels should wrap instead of truncating');
    assert(!labelRule.includes('text-overflow: ellipsis'),
        'Card type labels should not use an ellipsis');
    assert(indexHtml.includes('id="difficultyLevel"') && indexHtml.includes('themed-select'),
        'Difficulty should opt into the shared parchment select treatment');
    assert(indexHtml.includes('themed-select-wrap') && indexHtml.includes('themed-select-icon'),
        'Difficulty should use an explicit themed dropdown icon');
    assert(selectRule.includes('appearance: none'),
        'Difficulty should replace the native browser select chrome');
    assert(selectRule.includes('background-image:'),
        'Difficulty should expose a themed dropdown affordance');
}

{
    const styles = read('styles.css');
    const notesRule = lastRuleBody(styles, '.campaign-page .notes-header');
    const photoRules = ruleBodies(styles, '.campaign-page .image-input-label');

    ['dungeons_of_enveron.html', 'forbidden_creed.html'].forEach(file => {
        const html = read(file);
        assert(/<button[^>]*class="notes-header"[^>]*aria-expanded="false"/.test(html),
            `${file} campaign notes should use a semantic disclosure button`);
        assert(html.includes('class="fas fa-chevron-down collapse-icon"'),
            `${file} campaign notes should use the shared chevron icon`);
        assert(/<button[^>]*class="image-input-label"[^>]*data-add-photo/.test(html),
            `${file} Add Photo should be a keyboard-operable themed button`);
        assert(html.includes('class="fas fa-camera"'),
            `${file} Add Photo should use a camera icon`);
    });

    assert(notesRule.includes("font-family: 'Cinzel', serif"),
        'Campaign Notes should use the display typeface');
    assert(notesRule.includes('border:'),
        'Campaign Notes should use brass-accented control chrome');
    assert(photoRules.some(rule => rule.includes('var(--dm-oxblood)')),
        'Add Photo should use the oxblood action treatment');
    assert(photoRules.every(rule => !rule.includes('accent-success')),
        'Add Photo should not use the generic green success treatment');
    assert(styles.includes('.campaign-marker-icon'),
        'Campaign markers should use an explicit icon treatment');
    assert(!styles.includes("content: '\\2713'"),
        'Campaign markers should not use a generic generated check glyph');
}

{
    const indexHtml = read('index.html');
    const styles = read('styles.css');
    const closeRule = lastRuleBody(styles, '.deck-card-close');
    const progressTextRules = ruleBodies(styles, '#deckProgress .progress-text');

    assert(/id="clearActiveCard"[^>]*type="button"[^>]*aria-label="Clear active card"/.test(indexHtml),
        'Active card close control should expose its button type and accessible name');
    assert(indexHtml.includes('deck-card-close'),
        'Active card close control should use the shared themed close treatment');
    assert(indexHtml.includes('aria-label="Deck progress"'),
        'Deck progress should expose an accessible name');
    assert(closeRule.includes('var(--dm-oxblood)') && closeRule.includes('var(--dm-brass'),
        'Active card close control should use oxblood and brass chrome');
    assert(progressTextRules.some(rule => rule.includes("font-family: 'Cinzel', serif")),
        'Deck progress text should use the display typeface');
}

{
    const indexHtml = read('index.html');

    assert(/class="modal fade themed-modal" id="campaignModal"/.test(indexHtml),
        'Campaign chooser should use the shared themed dialog surface');
    assert(/class="modal fade themed-modal" id="cardPreviewModal"/.test(indexHtml),
        'Card preview should use the shared themed dialog surface');
    assert(!indexHtml.includes('modal-content bg-dark text-white'),
        'App dialogs should not force the generic Bootstrap dark surface');
    assert(!indexHtml.includes('form-control bg-dark text-light border-secondary'),
        'Themed dialog inputs should not force generic Bootstrap utility colours');
}

console.log('All shared theme coverage checks passed!');
