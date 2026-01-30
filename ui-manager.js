/**
 * ui-manager.js - Handles UI generation and DOM updates
 */
import { state, slugify, cardTypeId } from './state.js';
import { parseCardTypes } from './card-utils.js';
import { debounce, showToast } from './app-utils.js';
import { saveConfiguration } from './config-manager.js';

const debouncedSaveConfiguration = debounce(saveConfiguration, 400);

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

        // Add event listener to each checkbox
        checkbox.addEventListener('change', () => {
            loadCardTypes();
            debouncedSaveConfiguration();
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
    // Sync selected games from UI
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
            if (parseInt(input.value) < parseInt(input.max)) {
                input.value = parseInt(input.value) + 1;
                debouncedSaveConfiguration();
            }
        });
    });

    document.querySelectorAll('.decrease-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.currentTarget.getAttribute('data-type');
            const input = document.getElementById(cardTypeId(type));
            if (parseInt(input.value) > 0) {
                input.value = parseInt(input.value) - 1;
                debouncedSaveConfiguration();
            }
        });
    });

    document.querySelectorAll('.input-count').forEach(input => {
        input.addEventListener('change', debouncedSaveConfiguration);
    });
}

function getSavedCardCount(type) {
    // During initialization, we might not have the full config yet
    // This is a simplified version that checks the state or storage
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

/**
 * Toggles the Deck Builder configuration UI
 */
export function toggleDeckBuilderUI(hide) {
    const controls = document.getElementById('deckBuilderControls');
    if (controls) {
        controls.style.display = hide ? 'none' : 'block';
    }
}
