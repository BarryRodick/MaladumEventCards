/**
 * ui-manager.js - Handles UI generation and DOM updates
 */
import { state, slugify, cardTypeId } from './state.js';
import { parseCardTypes } from './card-utils.js';
import { debounce } from './app-utils.js';
import { saveConfiguration } from './config-manager.js';
import { deriveDeckMode, formatDeckSummary, getGenerateDeckState } from './deck-flow-utils.js';
import { searchCards } from './card-data.mjs';
import { renderCardNode, renderCompactCardNode } from './card-renderer.mjs';

const debouncedSaveConfiguration = debounce(saveConfiguration, 400);

const MODE_COPY = {
    build: {
        eyebrow: 'Step 1 of 2',
        title: 'Build your deck',
        description: 'Choose games, set card counts, and generate the live deck when the setup is ready.'
    },
    play: {
        eyebrow: 'Step 2 of 2',
        title: 'Play the live deck',
        description: 'Draw from the live deck here. Use Edit Build to change setup or Search Cards to inject specific cards during play.'
    }
};

function clearElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

function getRenderOptions(extraOptions = {}) {
    return {
        document,
        iconRegistry: state.iconRegistry || {},
        ...extraOptions
    };
}

function getConfiguredCardCounts() {
    return state.allCardTypes.reduce((counts, type) => {
        const input = document.getElementById(cardTypeId(type));
        counts[type] = Math.max(0, parseInt(input?.value, 10) || 0);
        return counts;
    }, {});
}

/**
 * Generates game selection checkboxes
 */
export function generateGameSelection(games) {
    const gameCheckboxes = document.getElementById('gameCheckboxes');
    if (!gameCheckboxes) return;

    gameCheckboxes.innerHTML = '';
    games.forEach(game => {
        const div = document.createElement('div');
        div.classList.add('form-check');

        const id = `game-${slugify(game)}`;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = id;
        checkbox.value = game;
        checkbox.checked = state.selectedGames.length === 0 || state.selectedGames.includes(game);
        checkbox.classList.add('form-check-input');

        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = game;
        label.classList.add('form-check-label');

        div.appendChild(checkbox);
        div.appendChild(label);
        gameCheckboxes.appendChild(div);

        checkbox.addEventListener('change', () => {
            loadCardTypes();
            debouncedSaveConfiguration();
            renderDeckSummary();
        });
    });

    if (state.selectedGames.length === 0) {
        state.selectedGames = [...games];
    }
}

/**
 * Loads and processes card types based on selected games
 */
export function loadCardTypes() {
    state.selectedGames = [];
    state.allGames.forEach(game => {
        const checkbox = document.getElementById(`game-${slugify(game)}`);
        if (checkbox && checkbox.checked) {
            state.selectedGames.push(game);
        }
    });

    state.deckDataByType = {};
    state.allCardTypes = [];
    const uniqueTypes = new Set();
    let allCards = [];

    state.selectedGames.forEach(game => {
        if (state.dataStore.games[game]) {
            allCards = allCards.concat(state.dataStore.games[game]);
        }
    });

    state.availableCards = [...allCards];

    const searchInput = document.getElementById('cardSearchInput');
    if (searchInput) {
        updateCardSearchResults(searchInput.value);
    }

    allCards.forEach(card => {
        const typeInfo = parseCardTypes(card.type);
        typeInfo.allTypes.forEach(type => {
            uniqueTypes.add(type);
            if (!state.deckDataByType[type]) {
                state.deckDataByType[type] = [];
            }
            state.deckDataByType[type].push({ ...card });
        });
    });

    state.allCardTypes = Array.from(uniqueTypes).sort();
    generateCardTypeInputs();
    renderDeckSummary();
}

/**
 * Generates inputs for each card type
 */
export function generateCardTypeInputs() {
    const cardTypeInputs = document.getElementById('cardTypeInputs');
    if (!cardTypeInputs) return;

    cardTypeInputs.innerHTML = '';
    const fragment = document.createDocumentFragment();

    state.allCardTypes.forEach(type => {
        const uniqueCards = new Set(state.deckDataByType[type].map(card => card.id));
        const maxCount = uniqueCards.size;

        const div = document.createElement('div');
        div.classList.add('card-type-input', 'col-12', 'col-md-6', 'mb-3');

        const imageName = type.replace(/\s/g, '');
        const savedCount = getSavedCardCount(type);

        div.innerHTML = `
            <div class="card-type-row">
                <div class="card-type-label-group">
                    <img src="logos/${imageName}.jpg" alt="${type}" class="card-type-icon">
                    <span class="card-title card-type-label" title="${type} Cards">${type} Cards</span>
                </div>
                <div class="card-type-counter">
                    <button type="button" class="btn btn-sm btn-outline-secondary decrease-btn" data-type="${type}" aria-label="Decrease ${type} Cards">-</button>
                    <input type="number" id="${cardTypeId(type)}" min="0" max="${maxCount}" value="${savedCount}" class="form-control form-control-sm input-count" aria-label="${type} Cards count">
                    <button type="button" class="btn btn-sm btn-outline-secondary increase-btn" data-type="${type}" aria-label="Increase ${type} Cards">+</button>
                </div>
            </div>
        `;
        fragment.appendChild(div);
    });

    cardTypeInputs.appendChild(fragment);
    setupInputListeners();
}

function setupInputListeners() {
    document.querySelectorAll('.increase-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.currentTarget.getAttribute('data-type');
            const input = document.getElementById(cardTypeId(type));
            if (parseInt(input.value, 10) < parseInt(input.max, 10)) {
                input.value = parseInt(input.value, 10) + 1;
                debouncedSaveConfiguration();
                renderDeckSummary();
            }
        });
    });

    document.querySelectorAll('.decrease-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.currentTarget.getAttribute('data-type');
            const input = document.getElementById(cardTypeId(type));
            if (parseInt(input.value, 10) > 0) {
                input.value = parseInt(input.value, 10) - 1;
                debouncedSaveConfiguration();
                renderDeckSummary();
            }
        });
    });

    document.querySelectorAll('.input-count').forEach(input => {
        input.addEventListener('change', () => {
            debouncedSaveConfiguration();
            renderDeckSummary();
        });
    });
}

function getSavedCardCount(type) {
    if ((state.dataStore.sentryTypes.includes(type) && state.enableSentryRules) ||
        (state.dataStore.corrupterTypes.includes(type) && state.enableCorrupterRules)) {
        return state.specialCardCounts?.[type] || 0;
    }
    return state.cardCounts?.[type] || 0;
}

/**
 * Populates difficulty selection dropdown
 */
export function populateDifficultySelection() {
    const difficultySelect = document.getElementById('difficultyLevel');
    if (!difficultySelect) return;

    difficultySelect.innerHTML = '';
    state.difficultySettings.forEach((difficulty, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = difficulty.name;
        difficultySelect.appendChild(option);
    });

    difficultySelect.selectedIndex = state.selectedDifficultyIndex;
    updateDifficultyDetails();

    difficultySelect.addEventListener('change', (e) => {
        state.selectedDifficultyIndex = e.target.selectedIndex;
        updateDifficultyDetails();
        debouncedSaveConfiguration();
        renderDeckSummary();
    });
}

/**
 * Updates UI based on selected difficulty
 */
export function updateDifficultyDetails() {
    const difficultyDetails = document.getElementById('difficultyDetails');
    if (!difficultyDetails || !state.difficultySettings[state.selectedDifficultyIndex]) return;

    const selectedDifficulty = state.difficultySettings[state.selectedDifficultyIndex];
    difficultyDetails.textContent = selectedDifficulty.description || '';

    const noviceInput = document.getElementById(cardTypeId('Novice'));
    const veteranInput = document.getElementById(cardTypeId('Veteran'));

    if (noviceInput) noviceInput.value = selectedDifficulty.novice || 0;
    if (veteranInput) veteranInput.value = selectedDifficulty.veteran || 0;
}

export function updateCardSearchResults(rawQuery) {
    const resultsContainer = document.getElementById('cardSearchResults');
    const status = document.getElementById('cardSearchStatus');
    if (!resultsContainer || !status) return;

    const query = (rawQuery || '').trim().toLowerCase();
    clearElement(resultsContainer);

    if (!query) {
        status.textContent = '';
        return;
    }

    const sortedMatches = searchCards(state.availableCards, query);
    const maxResults = 50;
    const displayMatches = sortedMatches.slice(0, maxResults);

    status.textContent = sortedMatches.length === 0
        ? 'No matching cards found.'
        : `Showing ${displayMatches.length} of ${sortedMatches.length} matching cards.`;

    displayMatches.forEach(card => {
        const item = document.createElement('button');
        item.type = 'button';
        item.classList.add('card-search-item');
        item.setAttribute('aria-label', `Preview ${card.card}`);
        item.dataset.cardId = String(card.id);

        const preview = document.createElement('div');
        preview.className = 'card-search-thumb';
        preview.appendChild(renderCompactCardNode(card, getRenderOptions({ maxSections: 1 })));

        const meta = document.createElement('div');

        const name = document.createElement('div');
        name.className = 'card-search-name';
        name.textContent = card.card;
        meta.appendChild(name);

        const type = document.createElement('div');
        type.className = 'card-search-type text-muted';
        type.textContent = `${card.type} • ${card.game}`;
        meta.appendChild(type);

        item.appendChild(preview);
        item.appendChild(meta);
        resultsContainer.appendChild(item);
    });
}

export function initializeDeckFlowUI({ hasSavedConfig = false, hasActiveDeck = false } = {}) {
    const firstUse = !hasSavedConfig && !hasActiveDeck;

    state.uiMode = hasActiveDeck ? 'play' : 'build';
    state.isUtilityDrawerOpen = hasActiveDeck ? false : true;

    if (firstUse) {
        setCollapseState('gameCheckboxes', true);
        setCollapseState('cardTypeContent', true);
        setCollapseState('cardSearchContent', false);
    }

    setActionPanelOpen(false);
    setDeckMode(state.uiMode, { openUtilities: state.isUtilityDrawerOpen });
}

export function setDeckMode(requestedMode, options = {}) {
    const mode = deriveDeckMode({
        currentDeckLength: state.currentDeck.length,
        requestedMode
    });

    state.uiMode = mode;

    if (typeof options.openUtilities === 'boolean') {
        state.isUtilityDrawerOpen = options.openUtilities;
    } else if (requestedMode === 'build') {
        state.isUtilityDrawerOpen = true;
    } else if (requestedMode === 'play') {
        state.isUtilityDrawerOpen = false;
    }

    const experience = document.getElementById('deckExperience');
    if (experience) {
        experience.dataset.mode = mode;
    }

    const copy = MODE_COPY[mode];
    const eyebrow = document.getElementById('deckModeEyebrow');
    const title = document.getElementById('deckModeTitle');
    const description = document.getElementById('deckModeDescription');

    if (eyebrow) eyebrow.textContent = copy.eyebrow;
    if (title) title.textContent = copy.title;
    if (description) description.textContent = copy.description;

    const buildButton = document.getElementById('buildModeButton');
    const playButton = document.getElementById('playModeButton');
    const hasActiveDeck = state.currentDeck.length > 0;

    if (buildButton) {
        buildButton.classList.toggle('is-active', mode === 'build');
        buildButton.setAttribute('aria-pressed', String(mode === 'build'));
    }

    if (playButton) {
        playButton.disabled = !hasActiveDeck;
        playButton.classList.toggle('is-active', mode === 'play');
        playButton.setAttribute('aria-pressed', String(mode === 'play'));
    }

    setUtilitiesDrawerOpen(state.isUtilityDrawerOpen);
    renderDeckSummary();

    if (mode === 'build' && options.focusUtilities) {
        const utilityDrawer = document.getElementById('deckUtilityDrawer');
        utilityDrawer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (mode === 'play' && options.scrollToPlay) {
        scrollPlaySurfaceIntoView();
    }

    return mode;
}

export function setUtilitiesDrawerOpen(isOpen) {
    state.isUtilityDrawerOpen = !!isOpen;

    const drawer = document.getElementById('deckUtilityDrawer');
    const drawerBody = document.getElementById('deckUtilityDrawerBody');
    const toggleButton = document.getElementById('toggleUtilityDrawer');

    if (drawer) {
        drawer.dataset.drawerState = state.isUtilityDrawerOpen ? 'open' : 'closed';
        drawer.classList.toggle('is-collapsed', !state.isUtilityDrawerOpen);
    }

    if (drawerBody) {
        drawerBody.hidden = !state.isUtilityDrawerOpen;
    }

    if (toggleButton) {
        toggleButton.innerHTML = state.isUtilityDrawerOpen
            ? '<i class="fas fa-screwdriver-wrench me-2"></i> Hide Build Tools'
            : '<i class="fas fa-screwdriver-wrench me-2"></i> Open Build Tools';
        toggleButton.setAttribute('aria-expanded', String(state.isUtilityDrawerOpen));
    }
}

export function toggleUtilityDrawer() {
    setUtilitiesDrawerOpen(!state.isUtilityDrawerOpen);
}

export function openBuildTools() {
    setCollapseState('gameCheckboxes', true);
    setCollapseState('cardTypeContent', true);
    setCollapseState('cardSearchContent', false);
    setDeckMode('build', { openUtilities: true, focusUtilities: true });
}

export function openSearchTools() {
    setUtilitiesDrawerOpen(true);
    setCollapseState('gameCheckboxes', false);
    setCollapseState('cardTypeContent', false);
    setCollapseState('cardSearchContent', true);

    const utilityDrawer = document.getElementById('deckUtilityDrawer');
    utilityDrawer?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const searchInput = document.getElementById('cardSearchInput');
    searchInput?.focus();
}

export function renderDeckSummary() {
    updateGenerateButtonState();

    const activeDeckSection = document.getElementById('activeDeckSection');
    if (activeDeckSection) {
        activeDeckSection.style.display = state.currentDeck.length > 0 ? 'block' : 'none';
    }

    const summaryBar = document.getElementById('deckSummaryBar');
    if (summaryBar) {
        summaryBar.style.display = state.currentDeck.length > 0 ? 'block' : 'none';
    }

    const currentCard = state.currentIndex >= 0 ? state.currentDeck[state.currentIndex] : null;
    const difficultyName = state.difficultySettings[state.selectedDifficultyIndex]?.name || '';
    const summary = formatDeckSummary({
        selectedGames: state.selectedGames,
        difficultyName,
        enableSentryRules: state.enableSentryRules,
        enableCorrupterRules: state.enableCorrupterRules,
        currentDeckLength: state.currentDeck.length,
        currentIndex: state.currentIndex,
        discardPileLength: state.discardPile.length,
        inPlayCount: state.inPlayCards.length,
        currentCardName: currentCard?.card || ''
    });

    const summaryModeLabel = document.getElementById('deckSummaryModeLabel');
    const summaryTitle = document.getElementById('deckSummaryTitle');
    const summaryGames = document.getElementById('deckSummaryGames');
    const summaryDifficulty = document.getElementById('deckSummaryDifficulty');
    const summaryRemaining = document.getElementById('deckSummaryRemaining');
    const summaryDiscard = document.getElementById('deckSummaryDiscard');
    const summaryInPlay = document.getElementById('deckSummaryInPlay');
    const summarySentry = document.getElementById('deckSummarySentry');
    const summaryCorrupter = document.getElementById('deckSummaryCorrupter');

    if (summaryModeLabel) summaryModeLabel.textContent = state.uiMode === 'play' ? 'You are in Play' : 'Build preview';
    if (summaryTitle) summaryTitle.textContent = summary.statusText;
    if (summaryGames) summaryGames.textContent = summary.gamesText;
    const compactDifficulty = summary.difficultyText.replace(/\s*\([^)]*\)\s*$/, '');
    setSummaryChipValue(summaryDifficulty, compactDifficulty);
    setSummaryChipValue(summaryRemaining, summary.remainingCount);
    setSummaryChipValue(summaryDiscard, summary.discardCount);
    setSummaryChipValue(summaryInPlay, summary.inPlayCount);

    summaryDifficulty?.setAttribute('aria-label', `Difficulty: ${summary.difficultyText}`);
    summaryRemaining?.setAttribute('aria-label', `Remaining cards: ${summary.remainingCount}`);
    summaryDiscard?.setAttribute('aria-label', `Discarded cards: ${summary.discardCount}`);
    summaryInPlay?.setAttribute('aria-label', `Cards in play: ${summary.inPlayCount}`);

    if (summarySentry) {
        summarySentry.hidden = !summary.showSentryBadge;
    }

    if (summaryCorrupter) {
        summaryCorrupter.hidden = !summary.showCorrupterBadge;
    }
}

function setSummaryChipValue(chip, value) {
    if (!chip) return;
    const valueElement = chip.querySelector?.('.summary-chip-value');
    if (valueElement) {
        valueElement.textContent = String(value);
        return;
    }
    chip.textContent = String(value);
}

export function showCardPreview({ id, name, image, type, card: providedCard } = {}) {
    const modal = document.getElementById('cardPreviewModal');
    if (!modal) return;

    const resolvedCard = providedCard || resolvePreviewCard({ id, name, image });
    const card = preparePreviewCard(resolvedCard, { id, name, image, type });
    if (!card) return;

    setModalDataset(modal, 'cardId', card.id);
    setModalDataset(modal, 'cardName', card.card);
    setModalDataset(modal, 'cardImage', card.sourceImage || card.contents);
    setModalDataset(modal, 'cardType', card.type);
    setModalDataset(modal, 'cardGame', card.game);

    const title = modal.querySelector('[data-card-preview-title]');
    const surface = modal.querySelector('[data-card-preview-surface]');
    const typeEl = modal.querySelector('[data-card-preview-type]');
    const readableEl = modal.querySelector('[data-card-preview-readable]');
    const shuffleCountInput = document.getElementById('cardPreviewShuffleCount');
    const deckActionHint = modal.querySelector('[data-card-preview-hint]');
    const deckActionButtons = modal.querySelectorAll('[data-preview-deck-action]');
    const hasActiveDeck = state.currentDeck.length > 0;

    if (title) {
        title.textContent = card.card || 'Card Preview';
    }

    if (surface) {
        clearElement(surface);
        surface.appendChild(renderCardNode(card, getRenderOptions()));
    }

    if (typeEl) {
        typeEl.textContent = [card.type, card.game].filter(Boolean).join(' • ');
    }

    if (readableEl) {
        const rendererAlreadyShowsText = card.renderMode === 'rich';
        readableEl.hidden = rendererAlreadyShowsText;
        if (rendererAlreadyShowsText) {
            clearElement(readableEl);
        } else {
            renderCardPreviewSections(readableEl, card.sections);
        }
    }

    if (shuffleCountInput) {
        shuffleCountInput.disabled = !hasActiveDeck;
    }

    deckActionButtons.forEach(button => {
        button.disabled = !hasActiveDeck;
    });

    if (deckActionHint) {
        deckActionHint.textContent = hasActiveDeck
            ? 'Place this card directly into the active deck from here.'
            : 'Generate a deck to enable live deck actions.';
    }

    if (window.bootstrap?.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(modal).show();
    } else {
        modal.classList.add('show');
        modal.style.display = 'block';
        modal.removeAttribute('aria-hidden');
    }
}

function preparePreviewCard(card, legacy = {}) {
    if (!card && !legacy.id && !legacy.name && !legacy.image) return null;

    const sourceImage = card?.sourceImage || card?.contents || legacy.image || '';
    const sections = Array.isArray(card?.sections) ? card.sections : [];

    return {
        ...card,
        id: card?.id ?? legacy.id ?? '',
        card: card?.card || legacy.name || 'Card Preview',
        type: card?.type || legacy.type || '',
        game: card?.game || '',
        contents: card?.contents || sourceImage,
        sourceImage,
        sections,
        renderMode: card?.renderMode || (sourceImage ? 'image' : 'rich')
    };
}

function setModalDataset(modal, key, value) {
    if (value !== undefined && value !== null && value !== '') {
        modal.dataset[key] = String(value);
        return;
    }

    delete modal.dataset[key];
}

function resolvePreviewCard({ id, name, image } = {}) {
    const cardId = id !== undefined && id !== null ? String(id) : '';
    const numericId = Number(cardId);

    if (state.cardMap instanceof Map) {
        if (!Number.isNaN(numericId) && state.cardMap.has(numericId)) {
            return state.cardMap.get(numericId);
        }

        for (const card of state.cardMap.values()) {
            if (card && String(card.id) === cardId) {
                return card;
            }
        }
    }

    const pools = [
        state.availableCards,
        state.currentDeck,
        state.inPlayCards,
        state.discardPile,
        state.sentryDeck,
        state.setAsideCards
    ];

    for (const pool of pools) {
        if (!Array.isArray(pool)) continue;
        const match = pool.find(card => {
            if (!card) return false;
            if (cardId && String(card.id) === cardId) return true;
            if (image && card.contents === image) return true;
            return name && card.card === name;
        });
        if (match) return match;
    }

    return null;
}

function renderCardPreviewSections(container, sections = []) {
    if (typeof container.replaceChildren === 'function') {
        container.replaceChildren();
    } else {
        container.innerHTML = '';
    }

    const usableSections = Array.isArray(sections)
        ? sections.filter(isUsablePreviewSection)
        : [];

    if (usableSections.length === 0) {
        const fallback = document.createElement('p');
        fallback.classList.add('card-preview-readable-fallback');
        fallback.textContent = 'Readable text unavailable for this card. Use the image view.';
        container.appendChild(fallback);
        return;
    }

    usableSections.forEach(section => {
        const sectionEl = document.createElement('section');
        sectionEl.classList.add('card-preview-readable-section');

        const headerRow = document.createElement('div');
        headerRow.classList.add('card-preview-readable-header');

        const heading = document.createElement('h6');
        heading.textContent = section.label || section.header || 'Card text';
        headerRow.appendChild(heading);

        if (section.threshold !== undefined && section.threshold !== null && section.threshold !== '') {
            const threshold = document.createElement('span');
            threshold.classList.add('card-preview-threshold');
            threshold.textContent = `Threshold ${section.threshold}`;
            headerRow.appendChild(threshold);
        }

        sectionEl.appendChild(headerRow);

        String(section.text)
            .split(/\n{2,}/)
            .map(paragraph => paragraph.trim())
            .filter(Boolean)
            .forEach(paragraphText => {
                const paragraph = document.createElement('p');
                paragraph.textContent = paragraphText.replace(/\s*\n\s*/g, ' ');
                sectionEl.appendChild(paragraph);
            });

        container.appendChild(sectionEl);
    });
}

function isUsablePreviewSection(section) {
    if (!section || typeof section !== 'object') return false;
    const text = String(section.text || '').trim();
    const header = String(section.label || section.header || '').trim();
    if (!text) return false;
    return !/^todo\b/i.test(text) && !/^todo\b/i.test(header);
}

/**
 * Compatibility helper for older callers that toggled the full builder.
 */
export function toggleDeckBuilderUI(hide) {
    setUtilitiesDrawerOpen(!hide);
}

export function setActionPanelOpen(isOpen) {
    const content = document.getElementById('cardActionContent');
    if (!content) return;

    content.classList.add('collapse');
    content.classList.remove('collapsing');
    content.classList.toggle('show', !!isOpen);

    if (content.style) {
        content.style.height = '';
    }

    const trigger = document.querySelector('[data-bs-target="#cardActionContent"]');
    if (trigger) {
        trigger.classList.toggle('collapsed', !isOpen);
        trigger.setAttribute('aria-expanded', String(!!isOpen));
    }

    const utilityTrigger = document.getElementById('playUtilityActions');
    if (utilityTrigger) {
        utilityTrigger.classList.toggle('is-active', !!isOpen);
        utilityTrigger.setAttribute('aria-expanded', String(!!isOpen));
    }
}

export function toggleActionPanel() {
    const content = document.getElementById('cardActionContent');
    if (!content) return;
    setActionPanelOpen(!content.classList.contains('show'));
}

function updateGenerateButtonState() {
    const generateButton = document.getElementById('generateDeck');
    if (!generateButton) return;

    const generateState = getGenerateDeckState({
        selectedGames: state.selectedGames,
        cardCounts: getConfiguredCardCounts(),
        sentryTypes: state.dataStore.sentryTypes,
        corrupterTypes: state.dataStore.corrupterTypes,
        enableSentryRules: state.enableSentryRules,
        enableCorrupterRules: state.enableCorrupterRules,
        hasActiveDeck: state.currentDeck.length > 0
    });
    const iconClass = generateState.label === 'Rebuild Deck'
        ? 'fas fa-rotate'
        : generateState.label === 'Generate Deck'
            ? 'fas fa-dungeon'
            : 'fas fa-sliders';

    generateButton.disabled = !generateState.canGenerate;
    generateButton.setAttribute('aria-disabled', String(!generateState.canGenerate));
    generateButton.innerHTML = `<i class="${iconClass} me-2"></i> ${generateState.label}`;
}

function scrollPlaySurfaceIntoView() {
    const summaryBar = document.getElementById('deckSummaryBar');
    if (!summaryBar) return;

    requestAnimationFrame(() => {
        summaryBar.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function setCollapseState(contentId, expanded) {
    const content = document.getElementById(contentId);
    if (!content) return;

    const trigger = document.querySelector(`[data-bs-target="#${contentId}"]`);

    if (window.bootstrap?.Collapse) {
        const collapse = window.bootstrap.Collapse.getOrCreateInstance(content, { toggle: false });
        if (expanded) {
            collapse.show();
        } else {
            collapse.hide();
        }
    } else {
        content.classList.add('collapse');
        content.classList.toggle('show', expanded);
    }

    if (trigger) {
        trigger.classList.toggle('collapsed', !expanded);
        trigger.setAttribute('aria-expanded', String(expanded));
    }
}
