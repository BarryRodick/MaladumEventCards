/**
 * ui-manager.js - Handles UI generation and DOM updates
 */
import { state, slugify, cardTypeId } from './state.js';
import { parseCardTypes } from './card-utils.js';
import { debounce } from './app-utils.js';
import { saveConfiguration } from './config-manager.js';
import { deriveDeckMode, formatDeckSummary } from './deck-flow-utils.js';

const debouncedSaveConfiguration = debounce(saveConfiguration, 400);

const MODE_COPY = {
    build: {
        eyebrow: 'Build mode',
        title: 'Assemble your event deck',
        description: 'Choose games, configure counts, and keep search ready while you play.'
    },
    play: {
        eyebrow: 'Play mode',
        title: 'Run the deck from one screen',
        description: 'The active card stays front and center while setup, search, and rebuild tools remain one click away.'
    }
};

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
            <div class="d-flex align-items-center">
                <img src="logos/${imageName}.jpg" alt="${type}" class="mr-2" style="width: 30px; height: 30px;">
                <span class="card-title mr-auto">${type} Cards</span>
                <button class="btn btn-sm btn-outline-secondary decrease-btn" data-type="${type}" style="margin-right: 5px;">-</button>
                <input type="number" id="${cardTypeId(type)}" min="0" max="${maxCount}" value="${savedCount}" class="form-control form-control-sm input-count" style="width: 60px;">
                <button class="btn btn-sm btn-outline-secondary increase-btn" data-type="${type}" style="margin-left: 5px;">+</button>
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
    resultsContainer.innerHTML = '';

    if (!query) {
        status.textContent = 'Type to search across all available cards.';
        return;
    }

    const matches = state.availableCards.filter(card => card.card.toLowerCase().includes(query));
    const sortedMatches = matches.sort((a, b) => a.card.localeCompare(b.card));
    const maxResults = 50;
    const displayMatches = sortedMatches.slice(0, maxResults);

    status.textContent = matches.length === 0
        ? 'No matching cards found.'
        : `Showing ${displayMatches.length} of ${matches.length} matching cards.`;

    displayMatches.forEach(card => {
        const item = document.createElement('div');
        item.classList.add('card-search-item');
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-label', `Preview ${card.card}`);
        item.dataset.cardName = card.card;
        item.dataset.cardId = card.id;
        item.dataset.cardImage = card.contents;
        item.dataset.cardType = card.type;
        item.innerHTML = `
            <img src="cardimages/${card.contents}" alt="${card.card}" class="card-search-thumb">
            <div>
                <div class="card-search-name">${card.card}</div>
                <div class="card-search-type text-muted">${card.type}</div>
            </div>
        `;
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

    setCollapseState('cardActionContent', false);
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

    return mode;
}

export function setUtilitiesDrawerOpen(isOpen) {
    state.isUtilityDrawerOpen = !!isOpen;

    const drawer = document.getElementById('deckUtilityDrawer');
    const drawerBody = document.getElementById('deckUtilityDrawerBody');
    const toggleButton = document.getElementById('toggleUtilityDrawer');
    const summaryToggleButton = document.getElementById('summaryToggleUtilities');

    if (drawer) {
        drawer.dataset.drawerState = state.isUtilityDrawerOpen ? 'open' : 'closed';
        drawer.classList.toggle('is-collapsed', !state.isUtilityDrawerOpen);
    }

    if (drawerBody) {
        drawerBody.hidden = !state.isUtilityDrawerOpen;
    }

    if (toggleButton) {
        toggleButton.innerHTML = state.isUtilityDrawerOpen
            ? '<i class="fas fa-sliders me-2"></i> Collapse'
            : '<i class="fas fa-sliders me-2"></i> Expand';
        toggleButton.setAttribute('aria-expanded', String(state.isUtilityDrawerOpen));
    }

    if (summaryToggleButton) {
        summaryToggleButton.innerHTML = state.isUtilityDrawerOpen
            ? '<i class="fas fa-compass me-2"></i> Hide Utilities'
            : '<i class="fas fa-compass me-2"></i> Utilities';
        summaryToggleButton.setAttribute('aria-expanded', String(state.isUtilityDrawerOpen));
    }
}

export function toggleUtilityDrawer() {
    setUtilitiesDrawerOpen(!state.isUtilityDrawerOpen);
}

export function renderDeckSummary() {
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
        currentCardName: currentCard?.card || ''
    });

    const summaryModeLabel = document.getElementById('deckSummaryModeLabel');
    const summaryTitle = document.getElementById('deckSummaryTitle');
    const summaryGames = document.getElementById('deckSummaryGames');
    const summaryDifficulty = document.getElementById('deckSummaryDifficulty');
    const summaryRemaining = document.getElementById('deckSummaryRemaining');
    const summaryDiscard = document.getElementById('deckSummaryDiscard');
    const summarySentry = document.getElementById('deckSummarySentry');
    const summaryCorrupter = document.getElementById('deckSummaryCorrupter');

    if (summaryModeLabel) summaryModeLabel.textContent = state.uiMode === 'play' ? 'Play mode' : 'Build mode';
    if (summaryTitle) summaryTitle.textContent = summary.statusText;
    if (summaryGames) summaryGames.textContent = summary.gamesText;
    if (summaryDifficulty) summaryDifficulty.textContent = `Difficulty: ${summary.difficultyText}`;
    if (summaryRemaining) summaryRemaining.textContent = `Remaining: ${summary.remainingCount}`;
    if (summaryDiscard) summaryDiscard.textContent = `Discard: ${summary.discardCount}`;

    if (summarySentry) {
        summarySentry.hidden = !summary.showSentryBadge;
    }

    if (summaryCorrupter) {
        summaryCorrupter.hidden = !summary.showCorrupterBadge;
    }
}

export function showCardPreview({ id, name, image, type }) {
    const modal = document.getElementById('cardPreviewModal');
    if (!modal) return;

    if (id !== undefined && id !== null) {
        modal.dataset.cardId = id;
    } else {
        delete modal.dataset.cardId;
    }

    if (name) {
        modal.dataset.cardName = name;
    } else {
        delete modal.dataset.cardName;
    }

    if (image) {
        modal.dataset.cardImage = image;
    } else {
        delete modal.dataset.cardImage;
    }

    if (type) {
        modal.dataset.cardType = type;
    } else {
        delete modal.dataset.cardType;
    }

    const title = modal.querySelector('[data-card-preview-title]');
    const imageEl = modal.querySelector('[data-card-preview-image]');
    const typeEl = modal.querySelector('[data-card-preview-type]');
    const shuffleCountInput = document.getElementById('cardPreviewShuffleCount');
    const deckActionHint = modal.querySelector('[data-card-preview-hint]');
    const deckActionButtons = modal.querySelectorAll('[data-preview-deck-action]');
    const hasActiveDeck = state.currentDeck.length > 0;

    if (title) {
        title.textContent = name || 'Card Preview';
    }

    if (imageEl) {
        imageEl.src = image ? `cardimages/${image}` : '';
        imageEl.alt = name || 'Card preview';
    }

    if (typeEl) {
        typeEl.textContent = type ? `Type: ${type}` : '';
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

/**
 * Compatibility helper for older callers that toggled the full builder.
 */
export function toggleDeckBuilderUI(hide) {
    setUtilitiesDrawerOpen(!hide);
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
