// deckbuilder.js

// ============================
// 1. Service Worker Registration
// ============================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then((registration) => {
                console.log('Service Worker registered with scope:', registration.scope);

                // Listen for updates to the service worker
                registration.onupdatefound = () => {
                    const installingWorker = registration.installing;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                // New update available
                                showUpdateNotification();
                            }
                        }
                    };
                };
            }, (err) => {
                console.error('Service Worker registration failed:', err);
            });
    });
}

// Function to show an update notification to the user
function showUpdateNotification() {
    const updateModal = `
        <div class="modal fade" id="updateModal" tabindex="-1" role="dialog" aria-labelledby="updateModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-dialog-centered" role="document">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="updateModalLabel">Update Available</h5>
              </div>
              <div class="modal-body">
                A new version of the app is available. Reload to update.
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-primary" id="reloadButton">Reload</button>
              </div>
            </div>
          </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', updateModal);
    $('#updateModal').modal('show');

    document.getElementById('reloadButton').addEventListener('click', () => {
        window.location.reload();
    });
}

// ============================
// 2. Global Variables and Constants
// ============================

// Grouping of cards by type
let deckDataByType = {};

// Generated decks
let regularDeck = [];    // Regular cards
let specialDeck = [];    // Special cards (Sentry and Corrupter)
let currentDeck = [];    // Combined deck for display

// Current card index (-1 to start with back.jpg)
let currentIndex = -1;

// Discard pile
let discardPile = [];    // Cards that have been discarded

// Lists of games and card types
let allGames = [];       // All available games/categories
let allCardTypes = [];   // All available card types

// Selected games and card types
let selectedGames = [];  // Games selected by the user

// Data stores for cards and difficulties
let dataStore = {};          // Stores card data from JSON
let availableCards = [];     // Cards available for selection
let difficultySettings = []; // Difficulty configurations

// Define special card types dynamically after loading JSON
let sentryCardTypes = [];
let corrupterCardTypes = [];
let heldBackCardTypes = []; // New variable for held back card types

// Global variable for In Play Cards (Feature 2)
let inPlayCards = [];

// Global variable for set aside cards
let setAsideCards = []; // Moved outside generateDeck() for broader scope

// Global variable to store the initial deck size
let initialDeckSize = 0;

// Variable to hold deferred restoration configuration
let deferredDeckRestoration = null;

// ============================
// 3. Initialization and Data Loading
// ============================

document.addEventListener('DOMContentLoaded', () => {
    // Enable dark mode by default (optional)
    document.body.classList.add('dark-mode');

    // Fetch the JSON files and load the data
    Promise.all([
        fetch('maladumcards.json').then(response => response.json()),
        fetch('difficulties.json').then(response => response.json())
    ])
    .then(([cardsData, difficultiesData]) => {
        dataStore = cardsData; // Store cards data
        difficultySettings = difficultiesData.difficulties; // Store difficulty settings

        // Extract sentry, corrupter, and held back types from JSON
        sentryCardTypes = dataStore.sentryTypes || [];
        corrupterCardTypes = dataStore.corrupterTypes || [];
        heldBackCardTypes = dataStore.heldBackCardTypes || []; // Assign held back types

        // Get all games (categories) from the data
        allGames = Object.keys(dataStore.games);

        // Generate game selection checkboxes
        generateGameSelection(allGames);

        // Populate the difficulty selection dropdown
        populateDifficultySelection();

        // Load configuration if it exists
        loadConfiguration();

        // Initial load of card types based on selected games
        loadCardTypes(); // Now that selectedGames is set

        // Restore card counts
        restoreCardCounts();

        // Restore deck state if configuration exists
        if (deferredDeckRestoration) {
            restoreDeckState(deferredDeckRestoration);
            deferredDeckRestoration = null;

            // Display the deck
            if (currentDeck && currentDeck.length > 0) {
                displayDeck();
                updateInPlayCardsDisplay();
            }
        }

        // Set up event listeners
        setupEventListeners();

        // Enhance buttons after DOM content is loaded
        enhanceButtons();
    })
    .catch(error => console.error('Error loading the JSON files:', error));

    // Attach event listener to the generate button
    const generateDeckButton = document.getElementById('generateDeck');
    if (generateDeckButton) {
        generateDeckButton.addEventListener('click', generateDeck);
    } else {
        console.error('Element with ID "generateDeck" not found.');
    }

    // Automatically save configuration when card counts change
    document.addEventListener('input', (event) => {
        if (event.target.matches('.card-type-input input')) {
            saveConfiguration();
        }
    });

    // Attach event listener to the "Clear In-Play Cards" button
    const clearInPlayCardsButton = document.getElementById('clearInPlayCards');
    if (clearInPlayCardsButton) {
        clearInPlayCardsButton.addEventListener('click', clearInPlayCards);
    } else {
        console.error('Element with ID "clearInPlayCards" not found.');
    }

    // Attach event listeners for navigation buttons
    const prevCardButton = document.getElementById('prevCard');
    if (prevCardButton) {
        prevCardButton.addEventListener('click', () => {
            if (currentIndex > -1) {
                // Remove the last card from discardPile
                discardPile.pop();
                currentIndex--;
                showCurrentCard();
                saveConfiguration();
            }
        });
    } else {
        console.error('Element with ID "prevCard" not found.');
    }

    const nextCardButton = document.getElementById('nextCard');
    if (nextCardButton) {
        nextCardButton.addEventListener('click', () => {
            // Move the current card to the discard pile if it's not the starting card
            if (currentIndex >= 0 && currentIndex < currentDeck.length) {
                discardPile.push(currentDeck[currentIndex]);
            }

            currentIndex++;

            if (currentIndex >= currentDeck.length) {
                if (discardPile.length > 0) {
                    // Reshuffle the discard pile to form a new deck
                    currentDeck = shuffleDeck(discardPile);
                    initialDeckSize = currentDeck.length;
                    discardPile = [];
                    currentIndex = -1; // Reset to start of new deck
                    showToast('Deck reshuffled from discard pile.');
                } else {
                    // No more cards left to draw
                    showToast('No more cards in the deck.');
                    currentIndex--; // Stay at the last card
                    return;
                }
            }

            showCurrentCard();
            saveConfiguration();
        });
    } else {
        console.error('Element with ID "nextCard" not found.');
    }
});

// ============================
// 4. UI Generation Functions
// ============================

// Function to generate game selection checkboxes
function generateGameSelection(games) {
    const gameCheckboxes = document.getElementById('gameCheckboxes');
    if (!gameCheckboxes) {
        console.error('Element with ID "gameCheckboxes" not found.');
        return;
    }
    gameCheckboxes.innerHTML = ''; // Clear existing checkboxes
    games.forEach(game => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `game-${game}`;
        checkbox.value = game;
        checkbox.checked = selectedGames.length === 0 || selectedGames.includes(game); // Default to checked if no selection
        checkbox.classList.add('form-check-input', 'mr-2');

        const label = document.createElement('label');
        label.htmlFor = `game-${game}`;
        label.textContent = game;
        label.classList.add('form-check-label');

        const div = document.createElement('div');
        div.classList.add('form-check', 'mb-2');
        div.appendChild(checkbox);
        div.appendChild(label);

        gameCheckboxes.appendChild(div);
    });

    // If no games are selected yet, select all by default
    if (selectedGames.length === 0) {
        selectedGames = games.slice();
    }
}

// Function to parse card types considering '+' and '/'
function parseCardTypes(typeString) {
    let andTypes = typeString.split('+').map(s => s.trim());
    let types = [];
    andTypes.forEach(part => {
        let orTypes = part.split('/').map(s => s.trim());
        types = types.concat(orTypes);
    });
    return [...new Set(types)];
}

// Function to load card types based on selected games
function loadCardTypes() {
    // Get selected games
    selectedGames = [];
    allGames.forEach(game => {
        const checkbox = document.getElementById(`game-${game}`);
        if (checkbox && checkbox.checked) {
            selectedGames.push(game);
        }
    });

    // Reset deckDataByType and allCardTypes
    deckDataByType = {};
    allCardTypes = [];

    // Flatten cards from selected games and group by type
    let allCards = [];
    selectedGames.forEach(game => {
        if (dataStore.games[game]) {
            allCards = allCards.concat(dataStore.games[game]);
        }
    });

    // Copy allCards to availableCards (Always include all cards, including special cards)
    availableCards = [...allCards];
    console.log('Available Cards after reset:', availableCards);

    // Group cards by their types
    allCards.forEach(card => {
        let types = parseCardTypes(card.type);
        types.forEach(type => {
            if (!deckDataByType[type]) {
                deckDataByType[type] = [];
                allCardTypes.push(type);
            }
            deckDataByType[type].push({ ...card });
        });
    });

    // Remove duplicates from allCardTypes
    allCardTypes = [...new Set(allCardTypes)];

    // Dynamically include sentry and corrupter card types if they exist and are non-empty
    [...sentryCardTypes, ...corrupterCardTypes].forEach(specialType => {
        if (!allCardTypes.includes(specialType) && deckDataByType[specialType] && deckDataByType[specialType].length > 0) {
            allCardTypes.push(specialType);
        }
    });

    // Generate card type inputs with logos
    generateCardTypeInputs();
}

// Function to generate card type inputs with +/- buttons
function generateCardTypeInputs() {
    const cardTypeInputs = document.getElementById('cardTypeInputs');
    if (!cardTypeInputs) {
        console.error('Element with ID "cardTypeInputs" not found.');
        return;
    }
    cardTypeInputs.innerHTML = ''; // Clear previous inputs

    allCardTypes.sort(); // Sort the card types alphabetically

    allCardTypes.forEach(type => {
        // Adjust maxCount based on unique cards
        const uniqueCards = new Set(deckDataByType[type].map(card => card.id));
        const maxCount = uniqueCards.size; // Set max count to number of unique cards of this type

        const div = document.createElement('div');
        div.classList.add('card-type-input', 'col-12', 'col-md-6', 'mb-3');

        const imageName = type.replace(/\s/g, '');
        const cardHTML = `
            <div class="d-flex align-items-center">
                <img src="logos/${imageName}.jpg" alt="${type}" class="mr-2" style="width: 30px; height: 30px;">
                <span class="card-title mr-auto">${type} Cards</span>
                <button class="btn btn-sm btn-outline-secondary decrease-btn" data-type="${type}" style="margin-right: 5px;">-</button>
                <input type="number" id="type-${type}" min="0" max="${maxCount}" value="${getSavedCardCount(type)}" class="form-control form-control-sm input-count" style="width: 60px;">
                <button class="btn btn-sm btn-outline-secondary increase-btn" data-type="${type}" style="margin-left: 5px;">+</button>
            </div>
        `;

        div.innerHTML = cardHTML;
        cardTypeInputs.appendChild(div);
    });

    // Add event listeners for +/- buttons
    document.querySelectorAll('.increase-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const type = e.target.getAttribute('data-type');
            const input = document.getElementById(`type-${type}`);
            if (parseInt(input.value) < parseInt(input.max)) {
                input.value = parseInt(input.value) + 1;
                saveConfiguration(); // Save configuration after every change
            }
        });
    });

    document.querySelectorAll('.decrease-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const type = e.target.getAttribute('data-type');
            const input = document.getElementById(`type-${type}`);
            if (parseInt(input.value) > 0) {
                input.value = parseInt(input.value) - 1;
                saveConfiguration(); // Save configuration after every change
            }
        });
    });
}

// Helper function to get saved card count
function getSavedCardCount(type) {
    const savedConfig = JSON.parse(localStorage.getItem('savedConfig'));
    if (savedConfig) {
        if ((sentryCardTypes.includes(type) && savedConfig.enableSentryRules) ||
            (corrupterCardTypes.includes(type) && savedConfig.enableCorrupterRules)) {
            return savedConfig.specialCardCounts[type] || 0;
        } else {
            return savedConfig.cardCounts[type] || 0;
        }
    }
    return 0;
}

// ============================
// 5. Difficulty Selection Functions
// ============================

// Function to populate difficulty selection dropdown
function populateDifficultySelection() {
    const difficultySelect = document.getElementById('difficultyLevel');
    if (!difficultySelect) {
        console.error('Element with ID "difficultyLevel" not found.');
        return;
    }

    // Clear existing options
    difficultySelect.innerHTML = '';

    // Populate options
    difficultySettings.forEach((difficulty, index) => {
        const option = document.createElement('option');
        option.value = index; // Use index to reference the difficulty setting
        option.textContent = difficulty.name;
        option.setAttribute('data-novice', difficulty.novice);
        option.setAttribute('data-veteran', difficulty.veteran);
        difficultySelect.appendChild(option);
    });

    // Set a default selection if desired
    difficultySelect.selectedIndex = savedDifficultyIndex();

    // Display the selected difficulty details
    updateDifficultyDetails();
}

// Helper function to get saved difficulty index
function savedDifficultyIndex() {
    const savedConfig = JSON.parse(localStorage.getItem('savedConfig'));
    if (savedConfig && savedConfig.selectedDifficultyIndex !== undefined) {
        return savedConfig.selectedDifficultyIndex;
    }
    return 0; // Default to first difficulty
}

// Function to update difficulty details display and adjust counts
function updateDifficultyDetails() {
    const difficultySelect = document.getElementById('difficultyLevel');
    const selectedOption = difficultySelect.options[difficultySelect.selectedIndex];
    const noviceCount = selectedOption.getAttribute('data-novice');
    const veteranCount = selectedOption.getAttribute('data-veteran');

    const difficultyDetails = document.getElementById('difficultyDetails');
    if (difficultyDetails) {
        difficultyDetails.textContent = `Novice Cards: ${noviceCount}, Veteran Cards: ${veteranCount}`;
    }

    // Update the counts for Novice and Veteran card types
    const noviceInput = document.getElementById('type-Novice');
    if (noviceInput) {
        noviceInput.value = noviceCount;
        // Add highlight class
        noviceInput.classList.add('highlight-input');

        // Remove the highlight after a short delay
        setTimeout(() => {
            noviceInput.classList.remove('highlight-input');
        }, 2000); // Highlight lasts for 2 seconds
    }

    const veteranInput = document.getElementById('type-Veteran');
    if (veteranInput) {
        veteranInput.value = veteranCount;
        // Add highlight class
        veteranInput.classList.add('highlight-input');

        // Remove the highlight after a short delay
        setTimeout(() => {
            veteranInput.classList.remove('highlight-input');
        }, 2000); // Highlight lasts for 2 seconds
    }

    // Save the updated counts
    saveConfiguration();
}

// ============================
// 6. Configuration Functions
// ============================

// Save configuration function
function saveConfiguration() {
    const config = {
        selectedGames,
        selectedDifficultyIndex: document.getElementById('difficultyLevel').value,
        cardCounts: {},
        specialCardCounts: {},
        enableSentryRules: document.getElementById('enableSentryRules').checked,
        enableCorrupterRules: document.getElementById('enableCorrupterRules').checked,
        // Save arrays of card IDs instead of full objects
        currentDeckIds: currentDeck.map(card => card.id),
        currentIndex,
        discardPileIds: discardPile.map(card => card.id),
        inPlayCardIds: inPlayCards.map(card => card.id),
        initialDeckSize
    };
    allCardTypes.forEach(type => {
        const inputId = `type-${type}`;
        const element = document.getElementById(inputId);
        const count = parseInt(element.value) || 0;
        if ((sentryCardTypes.includes(type) && config.enableSentryRules) ||
            (corrupterCardTypes.includes(type) && config.enableCorrupterRules)) {
            config.specialCardCounts[type] = count;
        } else {
            config.cardCounts[type] = count;
        }
    });
    // Save configuration including deck state
    localStorage.setItem('savedConfig', JSON.stringify(config));
    console.log('Configuration Saved:', config);
}

// Load configuration function
function loadConfiguration() {
    const savedConfig = JSON.parse(localStorage.getItem('savedConfig'));
    if (savedConfig) {
        // Restore game selections
        selectedGames = savedConfig.selectedGames || [];

        // Restore selected difficulty
        const difficultySelect = document.getElementById('difficultyLevel');
        if (difficultySelect && savedConfig.selectedDifficultyIndex !== undefined) {
            difficultySelect.value = savedConfig.selectedDifficultyIndex;
        }

        // Restore Sentry Rules state
        const sentryRulesCheckbox = document.getElementById('enableSentryRules');
        if (sentryRulesCheckbox && savedConfig.enableSentryRules !== undefined) {
            sentryRulesCheckbox.checked = savedConfig.enableSentryRules;
            toggleSentryRulesOptions(); // Handle any UI changes if necessary
        }

        // Restore Corrupter Rules state
        const corrupterRulesCheckbox = document.getElementById('enableCorrupterRules');
        if (corrupterRulesCheckbox && savedConfig.enableCorrupterRules !== undefined) {
            corrupterRulesCheckbox.checked = savedConfig.enableCorrupterRules;
        }

        // Restore card counts is handled in generateCardTypeInputs()

        // Defer deck restoration until data structures are ready
        deferredDeckRestoration = savedConfig;
        console.log('Loaded Configuration:', savedConfig);
        console.log('Sentry Rules Enabled:', sentryRulesCheckbox.checked);
        console.log('Corrupter Rules Enabled:', corrupterRulesCheckbox.checked);
    } else {
        // If no configuration, set selectedGames to all games
        selectedGames = allGames.slice();
    }
}

// Function to restore deck state from saved configuration
function restoreDeckState(savedConfig) {
    // Reconstruct currentDeck from IDs
    if (savedConfig.currentDeckIds && Array.isArray(savedConfig.currentDeckIds)) {
        currentDeck = savedConfig.currentDeckIds.map(id => findCardById(id)).filter(card => card !== null);
    }
    if (savedConfig.currentIndex !== undefined) {
        currentIndex = savedConfig.currentIndex;
    }
    if (savedConfig.discardPileIds && Array.isArray(savedConfig.discardPileIds)) {
        discardPile = savedConfig.discardPileIds.map(id => findCardById(id)).filter(card => card !== null);
    }
    if (savedConfig.inPlayCardIds && Array.isArray(savedConfig.inPlayCardIds)) {
        inPlayCards = savedConfig.inPlayCardIds.map(id => findCardById(id)).filter(card => card !== null);
    }
    if (savedConfig.initialDeckSize !== undefined) {
        initialDeckSize = savedConfig.initialDeckSize;
    }
}

// Function to find a card by its ID
function findCardById(id) {
    // Search in availableCards
    let card = availableCards.find(card => card.id === id);
    if (card) return card;

    // If not found, search in setAsideCards
    card = setAsideCards.find(card => card.id === id);
    if (card) return card;

    // If still not found, search in all data
    for (let game in dataStore.games) {
        card = dataStore.games[game].find(card => card.id === id);
        if (card) return card;
    }

    console.error(`Card with ID ${id} not found.`);
    return null;
}

// Function to preserve and restore card counts when configuration changes
function preserveAndRestoreCardCounts() {
    // Store current card counts
    const preservedCounts = {};
    allCardTypes.forEach(type => {
        const inputId = `type-${type}`;
        const element = document.getElementById(inputId);
        if (element) {
            preservedCounts[type] = parseInt(element.value) || 0;
        }
    });

    // Reload card types to reflect any changes in selection
    loadCardTypes();

    // Restore preserved values
    allCardTypes.forEach(type => {
        const inputId = `type-${type}`;
        const element = document.getElementById(inputId);
        if (element && preservedCounts.hasOwnProperty(type)) {
            element.value = preservedCounts[type];
        }
    });
}

// Function to restore card counts after card type inputs are generated
function restoreCardCounts() {
    const savedConfig = JSON.parse(localStorage.getItem('savedConfig'));
    if (savedConfig && (savedConfig.cardCounts || savedConfig.specialCardCounts)) {
        allCardTypes.forEach(type => {
            const inputId = `type-${type}`;
            const element = document.getElementById(inputId);
            if (element) {
                if (((sentryCardTypes.includes(type) && savedConfig.enableSentryRules) ||
                    (corrupterCardTypes.includes(type) && savedConfig.enableCorrupterRules))) {
                    element.value = savedConfig.specialCardCounts[type] || 0;
                } else {
                    element.value = savedConfig.cardCounts[type] || 0;
                }
            }
        });
        console.log('Restored Card Counts from Configuration');
    }
}

// ============================
// 7. Deck Generation Functions
// ============================

function generateDeck() {
    if (selectedGames.length === 0) {
        showToast('Please select at least one game.');
        return;
    }

    currentIndex = -1; // Start with -1 to display back.jpg first
    regularDeck = [];
    specialDeck = [];
    discardPile = []; // Reset discard pile

    // Reset availableCards without affecting user inputs
    resetAvailableCards();

    const selectedCardsMap = new Map(); // Use Map to store selected cards and their types

    // Copy of card counts to manage counts during selection
    const cardCounts = {};
    const specialCardCounts = {};
    allCardTypes.forEach(type => {
        const inputId = `type-${type}`;
        const element = document.getElementById(inputId);
        const count = parseInt(element.value) || 0;
        if (sentryCardTypes.includes(type) && document.getElementById('enableSentryRules').checked) {
            specialCardCounts[type] = count;
        } else if (corrupterCardTypes.includes(type) && document.getElementById('enableCorrupterRules').checked) {
            specialCardCounts[type] = count;
        } else {
            cardCounts[type] = count;
        }
    });

    // Add console logs to check card counts
    console.log('Card Counts:', cardCounts);
    console.log('Special Card Counts:', specialCardCounts);

    // Check if Sentry Rules are enabled
    const isSentryEnabled = document.getElementById('enableSentryRules').checked;
    console.log('Sentry Rules Enabled:', isSentryEnabled);

    // Check if Corrupter Rules are enabled
    const isCorrupterEnabled = document.getElementById('enableCorrupterRules').checked;
    console.log('Corrupter Rules Enabled:', isCorrupterEnabled);

    // 1. Set Aside Cards Based on heldBackCardTypes
    setAsideCards = []; // Reset setAsideCards

    // Separate held back cards
    availableCards = availableCards.filter(card => {
        let types = parseCardTypes(card.type);
        if (types.some(type => heldBackCardTypes.includes(type))) {
            setAsideCards.push(card);
            return false; // Remove from availableCards
        }
        return true; // Keep in availableCards
    });

    // Proceed with selecting regular and special cards separately

    // Selecting regular cards based on counts from inputs (excluding special cards and held back cards)
    let hasRegularCardSelection = false;
    allCardTypes.forEach(type => {
        if (sentryCardTypes.includes(type) && isSentryEnabled) return; // Skip Sentry types when Sentry Rules are enabled
        if (corrupterCardTypes.includes(type) && isCorrupterEnabled) return; // Skip Corrupter types when Corrupter Rules are enabled
        if (heldBackCardTypes.includes(type)) return; // Skip held back types here
        const count = cardCounts[type];
        if (count > 0) {
            hasRegularCardSelection = true;
            const selectedCards = selectCardsByType(type, count, selectedCardsMap, cardCounts, false);
            regularDeck = regularDeck.concat(selectedCards);
        }
    });

    // Selecting special cards based on counts from inputs
    let hasSpecialCardSelection = false;
    allCardTypes.forEach(type => {
        if (sentryCardTypes.includes(type) && isSentryEnabled) {
            const count = specialCardCounts[type];
            if (count > 0) {
                hasSpecialCardSelection = true;
                const selectedSpecialCards = selectCardsByType(type, count, selectedCardsMap, specialCardCounts, true);
                specialDeck = specialDeck.concat(selectedSpecialCards);
            }
        } else if (corrupterCardTypes.includes(type) && isCorrupterEnabled) {
            const count = specialCardCounts[type];
            if (count > 0) {
                hasSpecialCardSelection = true;
                const selectedSpecialCards = selectCardsByType(type, count, selectedCardsMap, specialCardCounts, true);
                specialDeck = specialDeck.concat(selectedSpecialCards);
            }
        }
    });

    // Selecting held back cards based on counts from inputs
    let selectedHeldBackCards = [];
    heldBackCardTypes.forEach(type => {
        const count = cardCounts[type];
        if (count > 0) {
            hasRegularCardSelection = true;
            const selectedCards = selectHeldBackCardsByType(type, count, selectedCardsMap, cardCounts);
            selectedHeldBackCards = selectedHeldBackCards.concat(selectedCards);
        }
    });

    if (!hasRegularCardSelection && !hasSpecialCardSelection) {
        showToast('Please select at least one card type with a count greater than zero.');
        return;
    }

    // Apply Corrupter Rules if enabled
    if (isCorrupterEnabled) {
        if (regularDeck.length >= 5) {
            // 2. Randomly remove 5 cards
            let removedCards = [];
            for (let i = 0; i < 5; i++) {
                let indexToRemove = Math.floor(Math.random() * regularDeck.length);
                removedCards.push(regularDeck.splice(indexToRemove, 1)[0]);
            }

            // 3. Replace with 5 Corrupter Cards
            let corrupterCards = getSpecialCards(5, corrupterCardTypes);
            regularDeck = regularDeck.concat(corrupterCards);
        } else {
            showToast('Not enough cards to remove 5 cards for Corrupter Rules.');
        }
    }

    // 4. Shuffle in the selected held back cards
    regularDeck = regularDeck.concat(selectedHeldBackCards);

    // 5. Shuffle the Entire Deck
    regularDeck = shuffleDeck(regularDeck);

    // Combine regularDeck and specialDeck for display
    currentDeck = regularDeck.concat(specialDeck);

    // Set initial deck size
    initialDeckSize = currentDeck.length;

    // Save the current configuration
    saveConfiguration();

    // Log for debugging
    console.log('Selected Games:', selectedGames);
    console.log('Regular Card Counts:', cardCounts);
    console.log('Special Card Counts:', specialCardCounts);
    console.log('Available Cards:', availableCards);
    console.log('Generated Regular Deck:', regularDeck);
    console.log('Generated Special Deck:', specialDeck);
    console.log('Sentry Rules Enabled:', isSentryEnabled);
    console.log('Corrupter Rules Enabled:', isCorrupterEnabled);

    // Display the deck
    displayDeck();

    // Show the Card Action section after deck generation
    const cardActionSection = document.getElementById('cardActionSection');
    if (cardActionSection) {
        cardActionSection.style.display = 'block';
    }

    // Collapse the "Select Games" and "Scenario Config" sections
    $('#gameCheckboxes').collapse('hide');
    $('#scenarioConfig').collapse('hide');
    $('#cardTypeSection').collapse('hide');
}

// Function to select cards by type considering '+' and '/'
function selectCardsByType(cardType, count, selectedCardsMap, cardCounts, isSpecial = false) {
    let selectedCards = [];

    console.log(`Selecting ${count} cards for type: "${cardType}" (${isSpecial ? 'Special' : 'Regular'})`);

    // Cards that can satisfy this type (considering '/' as OR)
    let cardsOfType = availableCards.filter(card => {
        let types = parseCardTypes(card.type);
        return types.includes(cardType);
    });

    console.log(`Available cards for type "${cardType}":`, cardsOfType);

    // Shuffle cardsOfType
    let shuffledCards = shuffleDeck(cardsOfType);
    console.log(`Shuffled cards for type "${cardType}":`, shuffledCards);

    for (let card of shuffledCards) {
        if (selectedCards.length >= count) break;

        const cardId = card.id; // Use 'id' for uniqueness
        if (selectedCardsMap.has(cardId)) {
            console.log(`Card ID ${cardId} already selected.`);
            continue;
        }

        // Check if card has '+' types (AND types)
        let andTypes = card.type.split('+').map(s => s.trim());

        if (andTypes.length > 1) {
            // For '+' types, ensure all types have counts remaining
            let canSelect = true;
            for (let typePart of andTypes) {
                let orTypes = typePart.split('/').map(s => s.trim());
                let matched = false;
                for (let t of orTypes) {
                    if (cardCounts[t] > 0) {
                        matched = true;
                        break;
                    }
                }
                if (!matched) {
                    canSelect = false;
                    break;
                }
            }

            if (canSelect) {
                selectedCards.push(card);
                selectedCardsMap.set(cardId, true);
                console.log(`Selected card ID ${cardId} for type "${cardType}".`);

                // Decrease counts for all types
                for (let typePart of andTypes) {
                    let orTypes = typePart.split('/').map(s => s.trim());
                    for (let t of orTypes) {
                        if (cardCounts[t] > 0) {
                            cardCounts[t]--;
                            console.log(`Decreased count for type "${t}" to ${cardCounts[t]}.`);
                            break; // Only decrease once per '+'
                        }
                    }
                }
            } else {
                console.log(`Cannot select card ID ${cardId} due to insufficient counts.`);
            }
        } else {
            // For single type or '/' types
            if (cardCounts[cardType] > 0) {
                selectedCards.push(card);
                selectedCardsMap.set(cardId, true);
                cardCounts[cardType]--;
                console.log(`Selected card ID ${cardId} for type "${cardType}". New count: ${cardCounts[cardType]}.`);
            } else {
                console.log(`No remaining counts for type "${cardType}". Cannot select card ID ${cardId}.`);
            }
        }
    }

    console.log(`Selected Cards for type "${cardType}":`, selectedCards);
    return selectedCards;
}

// Function to select held back cards by type
function selectHeldBackCardsByType(cardType, count, selectedCardsMap, cardCounts) {
    let selectedCards = [];

    console.log(`Selecting ${count} held back cards for type: "${cardType}"`);

    // Cards that can satisfy this type (considering '/' as OR)
    let cardsOfType = setAsideCards.filter(card => {
        let types = parseCardTypes(card.type);
        return types.includes(cardType);
    });

    console.log(`Available held back cards for type "${cardType}":`, cardsOfType);

    // Shuffle cardsOfType
    let shuffledCards = shuffleDeck(cardsOfType);
    console.log(`Shuffled held back cards for type "${cardType}":`, shuffledCards);

    for (let card of shuffledCards) {
        if (selectedCards.length >= count) break;

        const cardId = card.id; // Use 'id' for uniqueness
        if (selectedCardsMap.has(cardId)) {
            console.log(`Card ID ${cardId} already selected.`);
            continue;
        }

        selectedCards.push(card);
        selectedCardsMap.set(cardId, true);
        cardCounts[cardType]--;
        console.log(`Selected held back card ID ${cardId} for type "${cardType}". New count: ${cardCounts[cardType]}.`);
    }

    console.log(`Selected Held Back Cards for type "${cardType}":`, selectedCards);
    return selectedCards;
}

// Function to get special cards (Sentry or Corrupter)
function getSpecialCards(count, specialTypes) {
    let specialCards = [];
    specialTypes.forEach(type => {
        if (deckDataByType[type]) {
            specialCards = specialCards.concat(deckDataByType[type]);
        }
    });
    if (specialCards.length === 0) {
        showToast('No special cards available.');
        return [];
    }
    // Shuffle and pick 'count' cards
    let shuffledSpecialCards = shuffleDeck([...specialCards]);
    return shuffledSpecialCards.slice(0, count);
}

// Function to shuffle the deck
function shuffleDeck(deck) {
    let shuffledDeck = [...deck];
    for (let i = shuffledDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledDeck[i], shuffledDeck[j]] = [shuffledDeck[j], shuffledDeck[i]];
    }
    return shuffledDeck;
}

// Function to reset availableCards without affecting the DOM
function resetAvailableCards() {
    // Flatten cards from selected games
    let allCards = [];
    selectedGames.forEach(game => {
        if (dataStore.games[game]) {
            allCards = allCards.concat(dataStore.games[game]);
        }
    });

    // Copy allCards to availableCards (Always include all cards, including special cards)
    availableCards = [...allCards];
    console.log('Available Cards after reset:', availableCards);
}

// ============================
// 8. Deck Display and Navigation Functions
// ============================

// Function to display the current card
function showCurrentCard() {
    const output = document.getElementById('deckOutput');
    if (!output) {
        console.error('Element with ID "deckOutput" not found.');
        return;
    }
    output.style.opacity = 0; // Start with transparent

    setTimeout(() => {
        output.innerHTML = ''; // Clear previous content

        let contentHTML = '';

        if (currentIndex === -1) {
            // Display back.jpg
            contentHTML = `
                <div class="card-item text-center">
                    <strong>Start the Game</strong><br>
                    <img src="cardimages/back.jpg" alt="Card Back" class="card-image img-fluid mt-2">
                </div>
            `;
        } else {
            const card = currentDeck[currentIndex];
            if (!card) {
                contentHTML = `<p>Card not found.</p>`;
            } else {
                const isSpecialCard = ((sentryCardTypes.includes(card.type) && document.getElementById('enableSentryRules').checked) ||
                                       (corrupterCardTypes.includes(card.type) && document.getElementById('enableCorrupterRules').checked));

                // Use .png extension for card images
                const imagePath = card.contents.replace(/\.\w+$/, '.png');
                contentHTML = `
                    <div class="card-item text-center">
                        <strong>${card.card}</strong>${card.type ? ` (${card.type})` : ''}
                        ${isSpecialCard ? `<span class="badge badge-warning ml-2">Special</span>` : ''}
                        <br>
                        <img src="cardimages/${imagePath}" alt="${card.card}" class="card-image img-fluid mt-2">
                    </div>
                `;

                // Add "Mark as In Play" button if not already in play
                if (!isCardInPlay(card)) {
                    contentHTML += `
                        <button id="markAsInPlay" class="btn btn-primary mt-2">Mark as In Play</button>
                    `;
                }
            }
        }

        output.innerHTML = contentHTML;

        // Update progress bar
        updateProgressBar();

        // Fade in
        output.style.opacity = 1;

        // Scroll the card display area into view
        output.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Add event listener for "Mark as In Play" button
        if (document.getElementById('markAsInPlay')) {
            document.getElementById('markAsInPlay').addEventListener('click', () => {
                markCardAsInPlay(currentDeck[currentIndex]);
            });
        }
    }, 200);
}

// Function to display the deck
function displayDeck() {
    const output = document.getElementById('deckOutput');
    const navButtons = document.getElementById('navigationButtons');
    const deckProgress = document.getElementById('deckProgress');

    if (!output || !navButtons || !deckProgress) {
        console.error('One or more required elements for deck display are missing.');
        return;
    }

    if (currentDeck.length === 0) {
        output.innerHTML = '<p>No cards selected.</p>';
        navButtons.style.display = 'none';
        deckProgress.style.display = 'none';
    } else {
        navButtons.style.display = 'block';
        deckProgress.style.display = 'block';
        showCurrentCard();
    }
}

// Function to update the progress bar
function updateProgressBar() {
    const progressBar = document.getElementById('progressBar');
    if (!progressBar) {
        console.error('Element with ID "progressBar" not found.');
        return;
    }

    let totalCards = initialDeckSize + 1; // Including the back card

    let currentCardNumber = currentIndex + 2; // +2 because currentIndex starts at -1

    if (currentCardNumber > totalCards) {
        currentCardNumber = totalCards;
    }

    let progressPercentage = (currentCardNumber / totalCards) * 100;

    progressBar.style.width = `${progressPercentage}%`;
    progressBar.setAttribute('aria-valuenow', progressPercentage.toFixed(0));

    progressBar.textContent = `Card ${currentCardNumber} of ${totalCards}`;
}

// ============================
// 9. Card Action Functions
// ============================

// Function to check if a card is already in play
function isCardInPlay(card) {
    return inPlayCards.some(inPlayCard => inPlayCard.id === card.id);
}

// Function to mark a card as in play
function markCardAsInPlay(card) {
    if (!isCardInPlay(card)) {
        inPlayCards.push(card);
        updateInPlayCardsDisplay();
        showToast(`Card "${card.card}" marked as in play.`);
        saveConfiguration();
    } else {
        showToast(`Card "${card.card}" is already in play.`);
    }
}

// Function to update the display of in-play cards
function updateInPlayCardsDisplay() {
    const inPlayContainer = document.getElementById('inPlayCards');
    const inPlaySection = document.getElementById('inPlaySection');
    if (!inPlayContainer || !inPlaySection) {
        console.error('Elements with IDs "inPlayCards" or "inPlaySection" not found.');
        return;
    }
    inPlayContainer.innerHTML = ''; // Clear previous content

    if (inPlayCards.length === 0) {
        inPlayContainer.innerHTML = '<p>No cards in play.</p>';
        inPlaySection.style.display = 'none';
        return;
    }

    inPlayCards.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('card', 'mb-2');
        cardDiv.style.width = '100%';

        const cardBody = document.createElement('div');
        cardBody.classList.add('card-body');

        const cardTitle = document.createElement('h5');
        cardTitle.classList.add('card-title');
        cardTitle.textContent = card.card;

        const cardImage = document.createElement('img');
        cardImage.src = `cardimages/${card.contents.replace(/\.\w+$/, '.png')}`;
        cardImage.alt = card.card;
        cardImage.classList.add('card-img-top', 'mb-2');

        const removeButton = document.createElement('button');
        removeButton.classList.add('btn', 'btn-danger', 'btn-sm');
        removeButton.textContent = 'Remove from Play';
        removeButton.addEventListener('click', () => {
            removeCardFromPlay(card);
        });

        cardBody.appendChild(cardTitle);
        cardBody.appendChild(cardImage);
        cardBody.appendChild(removeButton);
        cardDiv.appendChild(cardBody);
        inPlayContainer.appendChild(cardDiv);
    });

    // Show the In Play section
    inPlaySection.style.display = 'block';
}

// Function to remove a card from play
function removeCardFromPlay(card) {
    inPlayCards = inPlayCards.filter(inPlayCard => inPlayCard.id !== card.id);
    updateInPlayCardsDisplay();
    showToast(`Card "${card.card}" removed from play.`);
    saveConfiguration();
}

// Function to clear all in-play cards
function clearInPlayCards() {
    inPlayCards = [];
    updateInPlayCardsDisplay();
    showToast('All in-play cards have been cleared.');
    saveConfiguration();
}

// ============================
// 10. Deck Restoration and Helper Functions
// ============================

// Function to restore deck state from saved configuration
function restoreDeckState(savedConfig) {
    // Reconstruct currentDeck from IDs
    if (savedConfig.currentDeckIds && Array.isArray(savedConfig.currentDeckIds)) {
        currentDeck = savedConfig.currentDeckIds.map(id => findCardById(id)).filter(card => card !== null);
    }
    if (savedConfig.currentIndex !== undefined) {
        currentIndex = savedConfig.currentIndex;
    }
    if (savedConfig.discardPileIds && Array.isArray(savedConfig.discardPileIds)) {
        discardPile = savedConfig.discardPileIds.map(id => findCardById(id)).filter(card => card !== null);
    }
    if (savedConfig.inPlayCardIds && Array.isArray(savedConfig.inPlayCardIds)) {
        inPlayCards = savedConfig.inPlayCardIds.map(id => findCardById(id)).filter(card => card !== null);
    }
    if (savedConfig.initialDeckSize !== undefined) {
        initialDeckSize = savedConfig.initialDeckSize;
    }
}

// Function to find a card by its ID
function findCardById(id) {
    // Search in availableCards
    let card = availableCards.find(card => card.id === id);
    if (card) return card;

    // If not found, search in setAsideCards
    card = setAsideCards.find(card => card.id === id);
    if (card) return card;

    // If still not found, search in all data
    for (let game in dataStore.games) {
        card = dataStore.games[game].find(card => card.id === id);
        if (card) return card;
    }

    console.error(`Card with ID ${id} not found.`);
    return null;
}

// ============================
// 11. Setup Event Listeners
// ============================

function setupEventListeners() {
    // Event listener for game selection changes
    const gameCheckboxes = document.getElementById('gameCheckboxes');
    if (gameCheckboxes) {
        gameCheckboxes.addEventListener('change', (event) => {
            if (event.target && event.target.matches('input[type="checkbox"]')) {
                preserveAndRestoreCardCounts(); // Preserve and restore card counts
                saveConfiguration(); // Automatically save configuration when games are selected/deselected
            }
        });
    } else {
        console.error('Element with ID "gameCheckboxes" not found.');
    }

    // Event listener for difficulty selection changes
    const difficultyLevel = document.getElementById('difficultyLevel');
    if (difficultyLevel) {
        difficultyLevel.addEventListener('change', () => {
            updateDifficultyDetails();
            preserveAndRestoreCardCounts(); // Preserve and restore card counts
            showToast('Novice and Veteran card counts have been updated based on the selected difficulty.');
        });
    } else {
        console.error('Element with ID "difficultyLevel" not found.');
    }

    // Event listener for Sentry Rules checkbox
    const sentryRulesCheckbox = document.getElementById('enableSentryRules');
    if (sentryRulesCheckbox) {
        sentryRulesCheckbox.addEventListener('change', () => {
            toggleSentryRulesOptions();
            preserveAndRestoreCardCounts(); // Preserve and restore card counts
            saveConfiguration(); // Save configuration when Sentry Rules option changes
        });
    } else {
        console.error('Element with ID "enableSentryRules" not found.');
    }

    // Event listener for Corrupter Rules checkbox
    const corrupterRulesCheckbox = document.getElementById('enableCorrupterRules');
    if (corrupterRulesCheckbox) {
        corrupterRulesCheckbox.addEventListener('change', () => {
            saveConfiguration(); // Save configuration when Corrupter Rules option changes
            console.log('Corrupter Rules Enabled:', corrupterRulesCheckbox.checked);
        });
    } else {
        console.error('Element with ID "enableCorrupterRules" not found.');
    }

    // Event listener for Apply Card Action button
    const applyCardActionButton = document.getElementById('applyCardAction');
    if (applyCardActionButton) {
        applyCardActionButton.addEventListener('click', applyCardAction);
    } else {
        console.error('Element with ID "applyCardAction" not found.');
    }

    // Event listener for Card Action selection changes
    const cardActionSelect = document.getElementById('cardAction');
    if (cardActionSelect) {
        cardActionSelect.addEventListener('change', () => {
            const selectedAction = cardActionSelect.value;
            const topNInput = document.getElementById('actionTopNInput');
            if (selectedAction === 'shuffleTopN') {
                if (topNInput) {
                    topNInput.style.display = 'block';
                }
            } else {
                if (topNInput) {
                    topNInput.style.display = 'none';
                }
            }
        });
    } else {
        console.error('Element with ID "cardAction" not found.');
    }
}

// ============================
// 12. Card Action Functions
// ============================

// Function to apply selected card action
function applyCardAction() {
    const cardActionSelect = document.getElementById('cardAction');
    if (!cardActionSelect) {
        console.error('Element with ID "cardAction" not found.');
        return;
    }

    const selectedAction = cardActionSelect.value;
    const actionNInput = document.getElementById('actionN');
    let n = parseInt(actionNInput.value) || 0;

    if (selectedAction === '') {
        showToast('Please select a card action.');
        return;
    }

    if (currentIndex === -1) {
        showToast('No active card to perform action on.');
        return;
    }

    const activeCard = currentDeck[currentIndex];
    if (!activeCard) {
        showToast('Active card not found.');
        return;
    }

    switch (selectedAction) {
        case 'shuffleAnywhere':
            // Shuffle active card back into the remaining deck
            currentDeck.splice(currentIndex, 1);
            regularDeck.push(activeCard);
            regularDeck = shuffleDeck(regularDeck);
            currentDeck = regularDeck.concat(specialDeck);
            currentIndex = -1;
            showToast(`Card "${activeCard.card}" shuffled back into the deck.`);
            break;

        case 'shuffleTopN':
            if (n <= 0) {
                showToast('Please enter a valid number for N.');
                return;
            }
            // Shuffle active card into the next N cards
            if (currentIndex + n >= currentDeck.length) {
                n = currentDeck.length - currentIndex - 1;
            }
            if (n <= 0) {
                showToast('Not enough cards ahead to shuffle into.');
                return;
            }
            currentDeck.splice(currentIndex, 1);
            const nextNCards = currentDeck.slice(currentIndex, currentIndex + n);
            regularDeck = nextNCards.concat(activeCard);
            regularDeck = shuffleDeck(regularDeck);
            currentDeck.splice(currentIndex, 0, ...regularDeck);
            showToast(`Card "${activeCard.card}" shuffled into the next ${n} cards.`);
            break;

        case 'replaceSameType':
            // Replace active card with an unseen card of the same type
            const type = activeCard.type;
            const unseenCards = availableCards.filter(card => parseCardTypes(card.type).includes(type) && !selectedCardsMap.has(card.id));
            if (unseenCards.length === 0) {
                showToast(`No unseen cards available of type "${type}".`);
                return;
            }
            const replacementCard = unseenCards[Math.floor(Math.random() * unseenCards.length)];
            currentDeck[currentIndex] = replacementCard;
            showToast(`Card "${activeCard.card}" replaced with "${replacementCard.card}".`);
            break;

        case 'introduceSentry':
            // Introduce Sentry Cards into the deck
            if (sentryCardTypes.length === 0) {
                showToast('No Sentry card types available.');
                return;
            }
            const sentryCard = getSpecialCards(1, sentryCardTypes)[0];
            if (sentryCard) {
                currentDeck.splice(currentIndex + 1, 0, sentryCard);
                showToast(`Sentry Card "${sentryCard.card}" introduced into the deck.`);
            }
            break;

        default:
            showToast('Unknown card action selected.');
            break;
    }

    // Reset card action selection
    cardActionSelect.value = '';
    const topNInput = document.getElementById('actionTopNInput');
    if (topNInput) {
        topNInput.style.display = 'none';
    }

    // Update deck display and save configuration
    displayDeck();
    updateInPlayCardsDisplay();
    saveConfiguration();
}

// ============================
// 13. Helper Functions
// ============================

// Function to show a toast message
function showToast(message) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        console.error('Element with ID "toastContainer" not found.');
        return;
    }

    const toast = document.createElement('div');
    toast.classList.add('toast', 'show', 'align-items-center', 'text-white', 'bg-secondary', 'border-0');
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    const toastBody = document.createElement('div');
    toastBody.classList.add('d-flex');
    const toastMessage = document.createElement('div');
    toastMessage.classList.add('toast-body');
    toastMessage.textContent = message;
    toastBody.appendChild(toastMessage);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.classList.add('ml-auto', 'mb-1', 'close');
    closeButton.setAttribute('data-dismiss', 'toast');
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.innerHTML = '<span aria-hidden="true">&times;</span>';
    toastBody.appendChild(closeButton);

    toast.appendChild(toastBody);
    toastContainer.appendChild(toast);

    // Automatically remove the toast after 3 seconds
    setTimeout(() => {
        $(toast).toast('hide');
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }, 3000);
}

// Function to enhance buttons (e.g., tooltips)
function enhanceButtons() {
    // Initialize any tooltips or other UI enhancements here
    $('[data-toggle="tooltip"]').tooltip();
}

// Function to toggle Sentry Rules options
function toggleSentryRulesOptions() {
    // Handle UI changes if necessary when Sentry Rules are toggled
    // For example, show/hide certain sections or inputs
}

// ============================
// 14. Additional Helper Functions
// ============================

// Function to select card actions based on user selection
// Implemented as part of applyCardAction()

// ============================
// 15. End of deckbuilder.js
// ============================
