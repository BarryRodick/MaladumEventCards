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

// ============================
// 3. Initialization and Data Loading
// ============================

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

    // Event listener for game selection changes
    document.getElementById('gameCheckboxes').addEventListener('change', (event) => {
        if (event.target && event.target.matches('input[type="checkbox"]')) {
            preserveAndRestoreCardCounts(); // Preserve and restore card counts
            saveConfiguration(); // Automatically save configuration when games are selected/deselected
        }
    });

    // Event listener for difficulty selection changes
    document.getElementById('difficultyLevel').addEventListener('change', () => {
        updateDifficultyDetails();
        preserveAndRestoreCardCounts(); // Preserve and restore card counts
        showToast('Novice and Veteran card counts have been updated based on the selected difficulty.');
    });

    // Event listener for Sentry Rules checkbox
    document.getElementById('enableSentryRules').addEventListener('change', () => {
        toggleSentryRulesOptions();
        preserveAndRestoreCardCounts(); // Preserve and restore card counts
        saveConfiguration(); // Save configuration when Sentry Rules option changes
    });

    // Event listener for Corrupter Rules checkbox
    document.getElementById('enableCorrupterRules').addEventListener('change', () => {
        saveConfiguration(); // Save configuration when Corrupter Rules option changes
        console.log('Corrupter Rules Enabled:', document.getElementById('enableCorrupterRules').checked);
    });

    // Initial load of card types based on selected games
    loadCardTypes(); // Now that selectedGames is set

    // After card types are loaded, restore card counts
    restoreCardCounts();

    // Enhance buttons after DOM content is loaded
    enhanceButtons();
})
.catch(error => console.error('Error loading the JSON files:', error));

// ============================
// 4. UI Generation Functions
// ============================

// Function to generate game selection checkboxes
function generateGameSelection(games) {
    const gameCheckboxes = document.getElementById('gameCheckboxes');
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

// Function to load card types based on selected games
function loadCardTypes() {
    // Get selected games
    selectedGames = [];
    allGames.forEach(game => {
        const checkbox = document.getElementById(`game-${game}`);
        if (checkbox.checked) {
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

// Function to generate card type inputs with +/- buttons
function generateCardTypeInputs() {
    const cardTypeInputs = document.getElementById('cardTypeInputs');
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
                <input type="number" id="type-${type}" min="0" max="${maxCount}" value="0" class="form-control form-control-sm input-count" style="width: 60px;">
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

// ============================
// 5. Difficulty Selection Functions
// ============================

// Function to populate difficulty selection dropdown
function populateDifficultySelection() {
    const difficultySelect = document.getElementById('difficultyLevel');

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
    difficultySelect.selectedIndex = 0;

    // Display the selected difficulty details
    updateDifficultyDetails();
}

// Function to update difficulty details display and adjust counts
function updateDifficultyDetails() {
    const difficultySelect = document.getElementById('difficultyLevel');
    const selectedOption = difficultySelect.options[difficultySelect.selectedIndex];
    const noviceCount = selectedOption.getAttribute('data-novice');
    const veteranCount = selectedOption.getAttribute('data-veteran');

    const difficultyDetails = document.getElementById('difficultyDetails');
    difficultyDetails.textContent = `Novice Cards: ${noviceCount}, Veteran Cards: ${veteranCount}`;

    // Update the counts for Novice and Veteran card types
    const noviceInput = document.getElementById('type-Novice');
    if (noviceInput) {
        noviceInput.value = noviceCount;
        // Add highlight class
        noviceInput.classList.add('highlight-input');
    }

    const veteranInput = document.getElementById('type-Veteran');
    if (veteranInput) {
        veteranInput.value = veteranCount;
        // Add highlight class
        veteranInput.classList.add('highlight-input');
    }

    // Remove the highlight after a short delay
    setTimeout(() => {
        if (noviceInput) {
            noviceInput.classList.remove('highlight-input');
        }
        if (veteranInput) {
            veteranInput.classList.remove('highlight-input');
        }
    }, 2000); // Highlight lasts for 2 seconds

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
        enableCorrupterRules: document.getElementById('enableCorrupterRules').checked
    };
    allCardTypes.forEach(type => {
        const inputId = `type-${type}`;
        const element = document.getElementById(inputId);
        const count = parseInt(element.value) || 0;
        if ((sentryCardTypes.includes(type) && config.enableSentryRules) || (corrupterCardTypes.includes(type) && config.enableCorrupterRules)) {
            config.specialCardCounts[type] = count;
        } else {
            config.cardCounts[type] = count;
        }
    });
    // Save configuration including special rules state
    localStorage.setItem('savedConfig', JSON.stringify(config));
    console.log('Configuration Saved:', config);
}

// Load configuration function
function loadConfiguration() {
    const savedConfig = JSON.parse(localStorage.getItem('savedConfig'));
    if (savedConfig) {
        // Restore game selections
        allGames.forEach(game => {
            const checkbox = document.getElementById(`game-${game}`);
            if (checkbox) {
                checkbox.checked = savedConfig.selectedGames.includes(game);
            }
        });

        // Set selectedGames based on restored game selections
        selectedGames = savedConfig.selectedGames;

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

        console.log('Loaded Configuration:', savedConfig);
        console.log('Sentry Rules Enabled:', document.getElementById('enableSentryRules').checked);
        console.log('Corrupter Rules Enabled:', document.getElementById('enableCorrupterRules').checked);
    } else {
        // If no configuration, set selectedGames to all games
        selectedGames = allGames.slice();
    }
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
                if (((sentryCardTypes.includes(type) && savedConfig.enableSentryRules) || (corrupterCardTypes.includes(type) && savedConfig.enableCorrupterRules))) {
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

// ============================
// 1. Service Worker Registration
// ============================

// ... [Your existing Service Worker code] ...

// ============================
// 2. Global Variables and Constants
// ============================

// ... [Your existing global variables and constants] ...

// ============================
// 3. Initialization and Data Loading
// ============================

// ... [Your existing initialization and data loading code] ...

// ============================
// 4. UI Generation Functions
// ============================

// ... [Your existing UI generation functions] ...

// ============================
// 5. Difficulty Selection Functions
// ============================

// ... [Your existing difficulty selection functions] ...

// ============================
// 6. Configuration Functions
// ============================

// ... [Your existing configuration functions] ...

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

    // Set currentDeck to regularDeck
    currentDeck = regularDeck.slice(); // Start with regular deck

    // Special cards are kept in specialDeck and introduced later

    displayDeck();

    // Show the Card Action section after deck generation
    document.getElementById('cardActionSection').style.display = 'block';

    // Collapse the "Select Games" and "Scenario Config" sections
    $('#gameCheckboxes').collapse('hide');
    $('#scenarioConfig').collapse('hide');
    $('#cardTypeSection').collapse('hide');
}


// ... [Rest of your code remains the same] ...

// ============================
// End of deckbuilder.js
// ============================


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

// ... [Your existing deck display and navigation functions] ...

// ============================
// 9. Card Action Functions
// ============================

// ... [Your existing card action functions] ...

// ============================
// 10. Additional Helper Functions
// ============================

// ... [Your existing helper functions] ...

// ============================
// End of deckbuilder.js
// ============================


// ============================
// 8. Deck Display and Navigation Functions
// ============================

// Function to display the current card
function showCurrentCard() {
    const output = document.getElementById('deckOutput');
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
            const isSpecialCard = ((sentryCardTypes.includes(card.type) && document.getElementById('enableSentryRules').checked) ||
                                   (corrupterCardTypes.includes(card.type) && document.getElementById('enableCorrupterRules').checked));

            // Use .png extension for card images
            contentHTML = `
                <div class="card-item text-center">
                    <strong>${card.card}</strong>${card.type ? ` (${card.type})` : ''}
                    ${isSpecialCard ? `<span class="badge badge-warning ml-2">Special</span>` : ''}
                    <br>
                    <img src="cardimages/${card.contents.replace(/\.\w+$/, '.png')}" alt="${card.card}" class="card-image img-fluid mt-2">
                </div>
            `;

            // Add "Mark as In Play" button if not already in play
            if (!isCardInPlay(card)) {
                contentHTML += `
                    <button id="markAsInPlay" class="btn btn-primary mt-2">Mark as In Play</button>
                `;
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
    output.innerHTML = ''; // Clear previous deck

    const navButtons = document.getElementById('navigationButtons');

    const isSentryEnabled = document.getElementById('enableSentryRules').checked;
    const isCorrupterEnabled = document.getElementById('enableCorrupterRules').checked;

    if (currentDeck.length === 0 && (!isSentryEnabled || specialDeck.length === 0)) {
        output.innerHTML = '<p>No cards selected.</p>';
        navButtons.style.display = 'none';
        document.getElementById('deckProgress').style.display = 'none';
    } else {
        navButtons.style.display = 'block';
        document.getElementById('deckProgress').style.display = 'block';
        showCurrentCard();
    }
}

// Function to update the progress bar
function updateProgressBar() {
    const progressBar = document.getElementById('progressBar');

    const isSentryEnabled = document.getElementById('enableSentryRules').checked;
    const isCorrupterEnabled = document.getElementById('enableCorrupterRules').checked;

    let totalRegularCards = regularDeck.length + 1; // Including the back card
    let totalSpecialCards = specialDeck.length;
    let totalCards = totalRegularCards + totalSpecialCards;

    let currentCardNumber = Math.max(1, currentIndex + 2); // Ensure at least 1 for the back card

    let progressPercentage = (currentCardNumber / totalCards) * 100;

    progressBar.style.width = `${progressPercentage}%`;
    progressBar.setAttribute('aria-valuenow', progressPercentage.toFixed(0));

    progressBar.textContent = `Card ${currentCardNumber} of ${totalCards}`;
}

// Event listeners for navigation buttons
document.getElementById('prevCard').addEventListener('click', () => {
    if (currentIndex > -1) {
        currentIndex--;
        showCurrentCard();
    }
});

document.getElementById('nextCard').addEventListener('click', () => {
    const isSentryEnabled = document.getElementById('enableSentryRules').checked;
    const isCorrupterEnabled = document.getElementById('enableCorrupterRules').checked;

    if (currentIndex < currentDeck.length - 1) {
        currentIndex++;
        showCurrentCard();
    } else if ((isSentryEnabled || isCorrupterEnabled) && specialDeck.length > 0) {
        showToast('All regular cards have been revealed. Introduce special cards to continue.');
    } else {
        showToast('No more cards in the deck.');
    }
});

// Attach event listener to the generate button
document.getElementById('generateDeck').addEventListener('click', generateDeck);

// Automatically save configuration when card counts change
document.addEventListener('input', (event) => {
    if (event.target.matches('.card-type-input input')) {
        saveConfiguration();
    }
});

// ============================
// 9. Card Action Functions
// ============================

// Toggle visibility and availability of Sentry Actions based on Sentry Rules
function toggleSentryRulesOptions() {
    const isEnabled = document.getElementById('enableSentryRules').checked;
    const cardActionSelect = document.getElementById('cardAction');
    const introduceOption = cardActionSelect.querySelector('option[value="introduceSentry"]');
    
    if (introduceOption) {
        introduceOption.disabled = !isEnabled;
        if (!isEnabled) {
            // Reset cardAction to a default option if Sentry is disabled
            cardActionSelect.value = 'shuffleAnywhere';
        }
    }

    console.log('Toggle Sentry Rules Options:', isEnabled);
}

// Function to apply card action
document.getElementById('applyCardAction').addEventListener('click', () => {
    const cardAction = document.getElementById('cardAction').value;
    const isSentryEnabled = document.getElementById('enableSentryRules').checked;

    if (currentIndex === -1) {
        showToast('No active card to apply action.');
        return;
    }

    // The active card before any action
    const activeCard = currentDeck[currentIndex];

    console.log('Current Index:', currentIndex);
    console.log('Active Card Before Action:', activeCard);
    console.log('Current Deck Before Action:', currentDeck);

    if (cardAction === 'shuffleAnywhere') {
        // Logic for shuffleAnywhere
        // Remove the active card from the deck
        currentDeck.splice(currentIndex, 1);

        // Generate a random insertion index after the current index
        const insertionIndex = Math.floor(Math.random() * (currentDeck.length - currentIndex)) + currentIndex + 1;

        // Insert the card back into the deck
        currentDeck.splice(insertionIndex, 0, activeCard);

        showToast('Card shuffled back into the deck.');

        // Move to the previous card
        if (currentIndex > 0) {
            currentIndex--;
        } else {
            currentIndex = -1; // Go back to the start (back.jpg)
        }
    } else if (cardAction === 'shuffleTopN') {
        // Logic for shuffleTopN
        let topN = parseInt(document.getElementById('actionN').value);
        if (isNaN(topN) || topN <= 0) {
            showToast('Please enter a valid number for N.');
            return;
        }

        // Calculate the number of remaining cards after the current card
        const remainingCards = currentDeck.length - (currentIndex + 1);

        // Adjust topN if it exceeds the number of remaining cards
        if (topN > remainingCards) {
            topN = remainingCards;
            showToast(`Only ${remainingCards} cards remaining. Shuffling into the next ${remainingCards} cards.`);
        }

        if (topN > 0) {
            // Remove the active card from the deck
            currentDeck.splice(currentIndex, 1);

            // Calculate the insertion range starting from the next card
            const startRange = currentIndex + 1;
            const endRange = currentIndex + topN;

            // Generate a random insertion index within the specified range
            const insertionIndex = Math.floor(Math.random() * (endRange - startRange + 1)) + startRange;

            // Insert the card back into the deck
            currentDeck.splice(insertionIndex, 0, activeCard);

            showToast(`Card shuffled into the next ${topN} cards.`);
        } else {
            showToast('No remaining cards to shuffle into.');
        }

        // Move to the previous card
        if (currentIndex > 0) {
            currentIndex--;
        } else {
            currentIndex = -1; // Go back to the start (back.jpg)
        }
    } else if (cardAction === 'replaceSameType') {
        // Logic for replacing the active card with an unseen card of the same type
        replaceActiveCardWithUnseenSameType();
    } else if (cardAction === 'introduceSentry') {
        // Introduce Sentry Cards Logic
        if (isSentryEnabled && specialDeck.length > 0) {
            introduceSpecialCards(sentryCardTypes);
        } else {
            showToast('Sentry Rules are not enabled or there are no Sentry cards to introduce.');
        }
    } else if (cardAction === 'introduceCorrupter') {
        // Introduce Corrupter Cards Logic
        const isCorrupterEnabled = document.getElementById('enableCorrupterRules').checked;
        if (isCorrupterEnabled && specialDeck.length > 0) {
            introduceSpecialCards(corrupterCardTypes);
        } else {
            showToast('Corrupter Rules are not enabled or there are no Corrupter cards to introduce.');
        }
    } else {
        showToast('Please select a valid action.');
        return;
    }

    console.log('Current Deck After Action:', currentDeck);

    // Refresh the display
    showCurrentCard();
});

// Function to replace the active card with an unseen card of the same type
function replaceActiveCardWithUnseenSameType() {
    const activeCard = currentDeck[currentIndex];
    const activeCardTypes = parseCardTypes(activeCard.type).map(type => type.trim().toLowerCase()).sort();

    console.log('Active Card:', activeCard);
    console.log('Active Card Types:', activeCardTypes);

    // Get all cards of the same type from availableCards
    const allSameTypeCards = availableCards.filter(card => {
        let cardTypes = parseCardTypes(card.type).map(type => type.trim().toLowerCase()).sort();
        return JSON.stringify(cardTypes) === JSON.stringify(activeCardTypes);
    });

    console.log('All Same Type Cards:', allSameTypeCards);

    // Exclude cards already in the currentDeck
    const selectedCardIds = new Set(currentDeck.map(card => card.id));
    const unseenSameTypeCards = allSameTypeCards.filter(card => {
        const cardId = card.id;
        return !selectedCardIds.has(cardId);
    });

    console.log('Unseen Same Type Cards:', unseenSameTypeCards);

    if (unseenSameTypeCards.length === 0) {
        showToast('No unseen cards of the same type are available.');
        return;
    }

    // Randomly select a new card from unseenSameTypeCards
    const randomIndex = Math.floor(Math.random() * unseenSameTypeCards.length);
    const newCard = unseenSameTypeCards[randomIndex];

    console.log('Selected New Card:', newCard);

    // Replace the active card with the new card in the currentDeck
    currentDeck[currentIndex] = newCard;

    showToast(`Replaced the active card with a new unseen card of the same type.`);
}

// Function to introduce special cards into the remaining deck
function introduceSpecialCards(typesToIntroduce) {
    const specialCardsToIntroduce = specialDeck.filter(card => typesToIntroduce.includes(card.type));
    if (specialCardsToIntroduce.length === 0) {
        showToast('No special cards to introduce.');
        return;
    }

    // Define the starting point for shuffling (after the current card)
    const insertionStart = currentIndex + 1;

    // Extract the remaining deck
    const remainingDeck = currentDeck.slice(insertionStart);

    // Combine remaining deck with specialCardsToIntroduce
    const combinedDeck = remainingDeck.concat(specialCardsToIntroduce);

    // Shuffle the combined deck
    const shuffledCombinedDeck = shuffleDeck(combinedDeck);

    // Replace the remaining deck with the shuffled combined deck
    currentDeck = currentDeck.slice(0, insertionStart).concat(shuffledCombinedDeck);

    // Remove introduced cards from specialDeck
    specialDeck = specialDeck.filter(card => !typesToIntroduce.includes(card.type));

    // Disable the corresponding "Introduce Special Cards" option to prevent multiple introductions
    const cardActionSelect = document.getElementById('cardAction');
    const introduceOptionValue = typesToIntroduce === sentryCardTypes ? 'introduceSentry' : 'introduceCorrupter';
    const introduceOption = cardActionSelect.querySelector(`option[value="${introduceOptionValue}"]`);
    if (introduceOption) {
        introduceOption.disabled = true;
        showToast('Special cards have been introduced and cannot be introduced again.');
    }

    // Refresh the display
    showCurrentCard();

    showToast('Special cards have been introduced into the remaining deck.');
}

// ============================
// 10. Additional Helper Functions
// ============================

// Function to show a toast message
function showToast(message) {
    const toastContainer = document.getElementById('toastContainer');
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

// Function to enhance buttons with ripple effect and touch feedback
function enhanceButtons() {
    document.querySelectorAll('button').forEach(button => {
        // Handle the ripple effect on button click
        button.addEventListener('click', function (e) {
            // Touch feedback (vibration)
            if ('vibrate' in navigator) {
                navigator.vibrate(30);
            }

            // Create ripple
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            button.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        });

        // Visual feedback for button press
        button.addEventListener('pointerdown', function () {
            button.classList.add('button-pressed');
        });

        button.addEventListener('pointerup', function () {
            button.classList.remove('button-pressed');
        });

        button.addEventListener('pointerleave', function () {
            button.classList.remove('button-pressed');
        });
    });
}

// Functions to Manage In Play Cards

/** Check if a card is already in play */
function isCardInPlay(card) {
    return inPlayCards.some(c => c.id === card.id);
}

/** Mark a card as "In Play" */
function markCardAsInPlay(card) {
    if (!isCardInPlay(card)) {
        inPlayCards.push(card);
        showToast(`${card.card} marked as In Play.`);
        updateInPlaySection();
    } else {
        showToast(`${card.card} is already In Play.`);
    }
}

/** Update the "In Play" section display */
function updateInPlaySection() {
    const inPlaySection = document.getElementById('inPlaySection');
    const inPlayCardsDiv = document.getElementById('inPlayCards');

    if (inPlayCards.length === 0) {
        inPlaySection.style.display = 'none';
    } else {
        inPlaySection.style.display = 'block';
        inPlayCardsDiv.innerHTML = '';
        inPlayCards.forEach((card, index) => {
            let cardHTML = `
                <div class="card-item text-center">
                    <strong>${card.card}</strong>${card.type ? ` (${card.type})` : ''}
                    <br>
                    <img src="cardimages/${card.contents.replace(/\.\w+$/, '.png')}" alt="${card.card}" class="card-image img-fluid mt-2">
                    <br>
                    <button class="btn btn-danger mt-2 discardInPlayCard" data-index="${index}">Discard</button>
                </div>
            `;
            inPlayCardsDiv.innerHTML += cardHTML;
        });
        // Add event listeners for discard buttons
        document.querySelectorAll('.discardInPlayCard').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = e.target.getAttribute('data-index');
                discardInPlayCard(index);
            });
        });
    }
}

/** Discard a card from the "In Play" section */
function discardInPlayCard(index) {
    const card = inPlayCards.splice(index, 1)[0];
    showToast(`${card.card} has been discarded from In Play.`);
    updateInPlaySection();
}

// ============================
// 11. End of deckbuilder.js
// ============================
