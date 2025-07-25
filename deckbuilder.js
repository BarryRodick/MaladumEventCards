// deckbuilder.js
// Requires storage-utils.js for persistence helpers
import { parseCardTypes, shuffleDeck } from './card-utils.js';
import { showUpdateNotification } from './update-utils.js';

// Toggle verbose logging
const DEBUG = false;

// Helper to convert game names to safe ID strings
function slugify(text) {
    return text.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

// ============================
// 1. Service Worker Registration
// ============================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then((registration) => {
                if (DEBUG) console.log('Service Worker registered with scope:', registration.scope);

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

    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'NEW_VERSION') {
            showUpdateNotification(event.data.version);
        }
    });
}


// ============================
// 2. Global Variables and Constants
// ============================

// 1. Consolidate configuration constants
const CONFIG = {
    deck: {
        sentry: {
            defaultCount: 4,
            minCount: 3,
            maxCount: 5
        },
        corrupter: {
            defaultCount: 5,
            minCount: 3,
            maxCount: 7,
            preferredDeckSection: 'middle'
        }
    },
    storage: {
        key: 'savedConfig',
        testKey: '__storage_test__'
    }
};

// 2. Rename global variables for clarity
const state = {
    deck: {
        main: [],
        special: [],
        sentry: [],
        combined: [],
        discard: [],
        inPlay: []
    },
    cards: {
        available: [],
        selected: new Map()
    },
    games: {
        all: [],
        selected: []
    },
    cardTypes: {
        all: [],
        sentry: [],
        corrupter: [],
        heldBack: []
    },
    currentIndex: -1,
    initialDeckSize: 0,    // Add this line to initialize initialDeckSize
    difficulty: null       // Optional: Add this if you want to track difficulty
};

// Grouping of cards by type
let deckDataByType = {};

// Generated decks
let regularDeck = [];    // Regular cards
let specialDeck = [];    // Special cards (Corrupter)
let sentryDeck = [];     // Sentry cards
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
let cardMap = new Map();     // Map from card ID to card object

// Define special card types dynamically after loading JSON
let sentryCardTypes = [];
let corrupterCardTypes = [];
let heldBackCardTypes = []; // New variable for held back card types

// Global variable for In Play Cards (Feature 2)

// Global variable for set aside cards
let setAsideCards = []; // Moved outside generateDeck() for broader scope

// Variable to hold deferred restoration configuration
let deferredDeckRestoration = null;

// Simplify configuration storage by combining related settings
const GAME_CONFIG = {
    corrupter: {
        defaultCount: 5,
        minCount: 3,
        maxCount: 7,
        preferredDeckSection: 'middle'
    },
    sentry: {
        defaultCount: 4,
        minCount: 3,
        maxCount: 5
    }
};

// ============================
// 3. Initialization and Data Loading
// ============================

document.addEventListener('DOMContentLoaded', () => {
    // Track app initialization
    if (typeof gtag === 'function') {
        trackEvent('App', 'Initialize', 'Maladum Event Cards');
    }

    // Enable dark mode by default (optional)
    document.body.classList.add('dark-mode');

    // Initialize empty data structures
    dataStore = {
        games: {},
        sentryTypes: [],
        corrupterTypes: [],
        heldBackCardTypes: []
    };

    // Load saved configuration first, with storage check
    let savedConfig = null;
    if (storageUtils.isStorageAvailable()) {
        try {
            savedConfig = loadSavedConfig();
        } catch (e) {
            console.warn('Error loading saved config:', e);
        }
    }

    // Fetch the JSON files and load the data
    Promise.all([
        fetch('maladumcards.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .catch(error => {
                console.error('Error loading maladumcards.json:', error);
                return { games: {}, sentryTypes: [], corrupterTypes: [], heldBackCardTypes: [] };
            }),
        fetch('difficulties.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .catch(error => {
                console.error('Error loading difficulties.json:', error);
                return { difficulties: [] };
            })
    ])
    .then(([cardsData, difficultiesData]) => {
        // Safely assign data
        dataStore = cardsData || { games: {} };
        difficultySettings = difficultiesData?.difficulties || [];

        // Build a lookup map for cards by ID
        cardMap.clear();
        Object.keys(dataStore.games || {}).forEach(game => {
            (dataStore.games[game] || []).forEach(card => {
                cardMap.set(card.id, card);
            });
        });

        // Extract special types with fallbacks
        sentryCardTypes = dataStore.sentryTypes || [];
        corrupterCardTypes = dataStore.corrupterTypes || [];
        heldBackCardTypes = dataStore.heldBackCardTypes || [];

        // Get all games (categories) from the data
        allGames = Object.keys(dataStore.games || {});

        // Only proceed with UI generation if we have data
        if (allGames.length > 0) {
            // Restore selected games from saved config or use all games
            selectedGames = (savedConfig && savedConfig.selectedGames) || allGames.slice();

            // Generate UI elements
            generateGameSelection(allGames);
            populateDifficultySelection();
            loadCardTypes();

            // Restore saved state if available
            if (savedConfig) {
                // First restore basic config
                restoreSavedState(savedConfig);

                // Then restore full deck state if it exists
                restoreDeckState(savedConfig);
            }
        } else {
            showToast('No game data available. Please check your connection and refresh.');
        }

        // Set up event listeners
        setupEventListeners();
        enhanceButtons();
    })
    .catch(error => {
        console.error('Error loading the JSON files:', error);
        showToast('Failed to load game data. Please refresh the page.');
    });

    // Attach event listener to the generate button
    domUtils.addEvent('generateDeck', 'click', generateDeck);

    // Automatically save configuration when card counts change
    document.addEventListener('input', (event) => {
        if (event.target.matches('.card-type-input input')) {
            debouncedSaveConfiguration();
        }
    });

    // Attach event listener to the "Clear In-Play Cards" button
    domUtils.addEvent('clearInPlayCards', 'click', clearInPlayCards);

    // Attach event listeners for navigation buttons
    const prevCardButton = domUtils.getEl('prevCard');
    if (prevCardButton) {
        prevCardButton.addEventListener('click', () => {
            if (currentIndex > -1) {
                // Going back from a card
                if (currentIndex === 0) {
                    // When going back from the first card to the card back
                    currentIndex = -1;
                } else {
                    // Remove the last card from discardPile if we're moving from one card to another
                    // (not when we're moving from card 1 to card back)
                    discardPile.pop();
                    currentIndex--;
                }
                state.currentIndex = currentIndex;
                showCurrentCard('backward');
                debouncedSaveConfiguration();
                trackEvent('Navigation', 'Previous Card', `Index: ${currentIndex}`);
            }
        });
    }

    const nextCardButton = domUtils.getEl('nextCard');
    if (nextCardButton) {
        nextCardButton.addEventListener('click', advanceToNextCard);
    }

    const deckOutput = domUtils.getEl('deckOutput');
    if (deckOutput) {
        deckOutput.addEventListener('click', (e) => {
            if (e.target.tagName === 'IMG' && !e.target.closest('#clearActiveCard')) {
                advanceToNextCard();
            }
        });
    }

    const markInPlayButton = domUtils.getEl('markInPlay');
    if (markInPlayButton) {
        markInPlayButton.addEventListener('click', () => {
            if (currentIndex >= 0 && currentDeck[currentIndex]) {
                markCardAsInPlay(currentDeck[currentIndex]);
            }
        });
    }

    const clearActiveCardButton = domUtils.getEl('clearActiveCard');
    if (clearActiveCardButton) {
        clearActiveCardButton.addEventListener('click', clearActiveCard);
    }

    // Call this function when the page loads
    setupNumberInputs();
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

    // Create a container for each checkbox
    games.forEach(game => {
        const div = document.createElement('div');
        div.classList.add('form-check');

        const id = `game-${slugify(game)}`;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = id;
        checkbox.value = game;
        checkbox.checked = selectedGames.length === 0 || selectedGames.includes(game);
        checkbox.classList.add('form-check-input');

        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = game;
        label.classList.add('form-check-label');

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
        const checkbox = document.getElementById(`game-${slugify(game)}`);
        if (checkbox && checkbox.checked) {
            selectedGames.push(game);
        }
    });

    // Reset data structures
    deckDataByType = {};
    allCardTypes = [];
    let uniqueTypes = new Set();

    // Flatten cards from selected games
    let allCards = [];
    selectedGames.forEach(game => {
        if (dataStore.games[game]) {
            allCards = allCards.concat(dataStore.games[game]);
        }
    });

    // Copy allCards to availableCards
    availableCards = [...allCards];
    if (DEBUG) console.log('Available Cards after reset:', availableCards);

    // Process each card's type correctly
    allCards.forEach(card => {
        const typeInfo = parseCardTypes(card.type);

        // Add all unique types to our set
        typeInfo.allTypes.forEach(type => uniqueTypes.add(type));

        // Add card to each of its possible types
        typeInfo.allTypes.forEach(type => {
            if (!deckDataByType[type]) {
                deckDataByType[type] = [];
            }
            deckDataByType[type].push({ ...card });
        });
    });

    // Convert unique types to array
    allCardTypes = Array.from(uniqueTypes);

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

    const fragment = document.createDocumentFragment();

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
        fragment.appendChild(div);
    });

    cardTypeInputs.appendChild(fragment);

    // Add event listeners for +/- buttons
    document.querySelectorAll('.increase-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const type = e.target.getAttribute('data-type');
            const input = document.getElementById(`type-${type}`);
            if (parseInt(input.value) < parseInt(input.max)) {
                input.value = parseInt(input.value) + 1;
                debouncedSaveConfiguration(); // Save configuration after every change
            }
        });
    });

    document.querySelectorAll('.decrease-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const type = e.target.getAttribute('data-type');
            const input = document.getElementById(`type-${type}`);
            if (parseInt(input.value) > 0) {
                input.value = parseInt(input.value) - 1;
                debouncedSaveConfiguration(); // Save configuration after every change
            }
        });
    });
}

// Function to get saved card count with proper error handling
function getSavedCardCount(type) {
    try {
        if (!storageUtils.isStorageAvailable()) {
            return 0;
        }

        const savedConfig = localStorage.getItem(CONFIG.storage.key);
        if (!savedConfig) {
            return 0;
        }

        const config = JSON.parse(savedConfig);
        if (!config) {
            return 0;
        }

        // Check if the card is a special type and if special rules are enabled
        if ((sentryCardTypes.includes(type) && config.enableSentryRules) ||
            (corrupterCardTypes.includes(type) && config.enableCorrupterRules)) {
            return (config.specialCardCounts && config.specialCardCounts[type]) || 0;
        } else {
            return (config.cardCounts && config.cardCounts[type]) || 0;
        }
    } catch (e) {
        console.warn('Error getting saved card count:', e);
        return 0;
    }
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
    const difficultyDetails = document.getElementById('difficultyDetails');

    if (!difficultySelect || !difficultyDetails || !difficultySettings) {
        return; // Exit if elements aren't found or settings aren't loaded
    }

    const selectedIndex = difficultySelect.selectedIndex;
    const selectedDifficulty = difficultySettings[selectedIndex];

    if (selectedDifficulty) {
        // Update difficulty description
        difficultyDetails.textContent = selectedDifficulty.description || '';

        // Update novice and veteran card counts based on selected difficulty
        const noviceInput = document.getElementById('type-Novice');
        const veteranInput = document.getElementById('type-Veteran');

        if (noviceInput) {
            noviceInput.value = selectedDifficulty.novice || 0;
        }

        if (veteranInput) {
            veteranInput.value = selectedDifficulty.veteran || 0;
        }

        // Save state
        state.selectedDifficultyIndex = selectedIndex;

        // Only save if we have a valid configuration
        if (state.initialDeckSize > 0) {
            saveConfiguration();
        }

        if (DEBUG) console.log('Updated difficulty settings:', {
            name: selectedDifficulty.name,
            novice: selectedDifficulty.novice,
            veteran: selectedDifficulty.veteran
        });
    }
}

// ============================
// 6. Configuration Functions
// ============================

// Simple debounce utility to limit how often a function executes
function debounce(fn, delay = 400) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Function to save configuration
function saveConfiguration() {
    if (!storageUtils.isStorageAvailable()) {
        console.warn('Storage is not available, configuration will not be saved');
        return;
    }

    try {
        const config = {
            selectedGames: selectedGames,
            cardCounts: {},
            specialCardCounts: {},
            enableSentryRules: document.getElementById('enableSentryRules')?.checked || false,
            enableCorrupterRules: document.getElementById('enableCorrupterRules')?.checked || false,
            // Add deckState object to store all deck-related state
            deckState: {
                currentDeck: currentDeck,
                currentIndex: currentIndex,
                discardPile: discardPile,
                sentryDeck: sentryDeck,
                initialDeckSize: state.initialDeckSize,
                inPlayCards: state.deck.inPlay,
                // Persist individual deck arrays for accurate restoration
                mainDeck: state.deck.main,
                specialDeck: state.deck.special,
                combinedDeck: state.deck.combined
            }
        };

        // Save card counts
        allCardTypes.forEach(type => {
            const input = document.getElementById(`type-${type}`);
            if (input) {
                if ((sentryCardTypes.includes(type) && config.enableSentryRules) ||
                    (corrupterCardTypes.includes(type) && config.enableCorrupterRules)) {
                    config.specialCardCounts[type] = parseInt(input.value) || 0;
                } else {
                    config.cardCounts[type] = parseInt(input.value) || 0;
                }
            }
        });

        localStorage.setItem(CONFIG.storage.key, JSON.stringify(config));
        if (DEBUG) console.log('Game state saved:', {
            deckSize: currentDeck.length,
            currentIndex: currentIndex,
            discardPileSize: discardPile.length
        });

        // Don't track every save to avoid flooding analytics
        // Only track saves when there's a significant state change
        if (currentDeck.length > 0) {
            trackEvent('App State', 'Save Configuration', null, currentDeck.length);
        }
    } catch (e) {
        console.warn('Error saving configuration:', e);
    }
}

// Debounced version used for rapid events
const debouncedSaveConfiguration = debounce(saveConfiguration, 400);

// Function to restore deck state from saved configuration
function restoreDeckState(savedConfig) {
    if (!savedConfig) return;

    try {
        // Restore game selections
        if (savedConfig.selectedGames) {
            document.querySelectorAll('#gameCheckboxes input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = savedConfig.selectedGames.includes(checkbox.value);
            });
            selectedGames = savedConfig.selectedGames;
        }

        // Restore card counts
        if (savedConfig.cardCounts) {
            Object.entries(savedConfig.cardCounts).forEach(([type, count]) => {
                const inputElement = document.getElementById(`type-${type}`);
                if (inputElement) {
                    inputElement.value = count;
                }
            });
        }

        // Restore rule settings
        if (document.getElementById('enableSentryRules')) {
            document.getElementById('enableSentryRules').checked = savedConfig.enableSentryRules || false;
        }
        if (document.getElementById('enableCorrupterRules')) {
            document.getElementById('enableCorrupterRules').checked = savedConfig.enableCorrupterRules || false;
        }

        // Restore deck state
        if (savedConfig.deckState) {
            currentDeck = savedConfig.deckState.currentDeck || [];
            currentIndex = savedConfig.deckState.currentIndex || -1;
            state.currentIndex = currentIndex;
            discardPile = savedConfig.deckState.discardPile || [];
            sentryDeck = savedConfig.deckState.sentryDeck || [];
            state.initialDeckSize = savedConfig.deckState.initialDeckSize || 0;

            // Restore individual deck arrays
            state.deck.main = savedConfig.deckState.mainDeck || [];
            state.deck.special = savedConfig.deckState.specialDeck || [];
            state.deck.combined = savedConfig.deckState.combinedDeck || [];

            // Restore in-play cards
            state.deck.inPlay = savedConfig.deckState.inPlayCards || [];

            // Update the UI for in-play cards
            updateInPlayCardsDisplay();

            // Show the deck if it exists
            if (currentDeck && currentDeck.length > 0) {
                const activeDeckSection = document.getElementById('activeDeckSection');
                if (activeDeckSection) {
                    activeDeckSection.style.display = 'block';
                }

                // Display the current card
                showCurrentCard();

                // Update progress bar
                updateProgressBar();

                // Show the navigation buttons
                const navigationButtons = document.getElementById('navigationButtons');
                if (navigationButtons) {
                    navigationButtons.style.display = 'block';
                }

                // Show the card action section
                const cardActionSection = document.getElementById('cardActionSection');
                if (cardActionSection) {
                    cardActionSection.style.display = 'block';
                    updateCardActionSelect();
                }

                // Toggle deck builder UI
                toggleDeckBuilderUI(true);
            }

            if (DEBUG) console.log('Deck state restored:', {
                currentDeckSize: currentDeck.length,
                currentIndex: currentIndex,
                discardPileSize: discardPile.length,
                inPlayCardsSize: state.deck.inPlay.length,
                sentryDeckSize: sentryDeck.length
            });
        }
    } catch (error) {
        console.error('Error restoring deck state:', error);
        localStorage.removeItem('savedConfig');
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
    if (savedConfig && (savedConfig.cardCounts || savedConfig.specialCardCounts || savedConfig.sentryCardCounts)) {
        allCardTypes.forEach(type => {
            const inputId = `type-${type}`;
            const element = document.getElementById(inputId);
            if (element) {
                if ((sentryCardTypes.includes(type) && savedConfig.enableSentryRules) ||
                    (corrupterCardTypes.includes(type) && savedConfig.enableCorrupterRules)) {
                    element.value = savedConfig.specialCardCounts[type] || 0;
                } else {
                    element.value = savedConfig.cardCounts[type] || 0;
                }
            }
        });
        if (DEBUG) console.log('Restored Card Counts from Configuration');
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
    state.currentIndex = currentIndex;
    regularDeck = [];
    specialDeck = [];    // For Corrupter cards
    sentryDeck = [];     // For Sentry cards
    discardPile = [];    // Reset discard pile

    // Reset selectedCardsMap
    state.cards.selected.clear(); // Clears the Map without changing its reference

    // Reset availableCards without affecting user inputs
    resetAvailableCards();

    // Copy of card counts to manage counts during selection
    const cardCounts = {};
    const specialCardCounts = {};
    const sentryCardCounts = {}; // To store counts for Sentry cards

    allCardTypes.forEach(type => {
        const inputId = `type-${type}`;
        const element = document.getElementById(inputId);
        const count = parseInt(element.value) || 0;
        if (sentryCardTypes.includes(type) && document.getElementById('enableSentryRules').checked) {
            sentryCardCounts[type] = count;
        } else if (corrupterCardTypes.includes(type) && document.getElementById('enableCorrupterRules').checked) {
            specialCardCounts[type] = count;
        } else {
            cardCounts[type] = count;
        }
    });

    if (DEBUG) console.log('Card Counts:', cardCounts);
    if (DEBUG) console.log('Special Card Counts:', specialCardCounts);
    if (DEBUG) console.log('Sentry Card Counts:', sentryCardCounts);

    // Check if Sentry and Corrupter Rules are enabled
    const isSentryEnabled = document.getElementById('enableSentryRules').checked;
    if (DEBUG) console.log('Sentry Rules Enabled:', isSentryEnabled);

    const isCorrupterEnabled = document.getElementById('enableCorrupterRules').checked;
    if (DEBUG) console.log('Corrupter Rules Enabled:', isCorrupterEnabled);

    // 1. Set Aside Cards Based on heldBackCardTypes
    setAsideCards = []; // Reset setAsideCards

    // Separate held back cards
    availableCards = availableCards.filter(card => {
        const typeInfo = parseCardTypes(card.type);
        // Check if any of the card's types are in heldBackCardTypes
        const isHeldBack = typeInfo.allTypes.some(type => heldBackCardTypes.includes(type));
        if (isHeldBack) {
            setAsideCards.push(card);
            return false; // Remove from availableCards
        }
        return true; // Keep in availableCards
    });

    // Proceed with selecting regular, Corrupter, and Sentry cards separately

    // Selecting regular cards based on counts from inputs (excluding special and held back cards)
    let hasRegularCardSelection = false;
    allCardTypes.forEach(type => {
        if (sentryCardTypes.includes(type) && isSentryEnabled) return; // Skip Sentry types
        if (corrupterCardTypes.includes(type) && isCorrupterEnabled) return; // Skip Corrupter types
        if (heldBackCardTypes.includes(type)) return; // Skip held back types here
        const count = cardCounts[type];
        if (count > 0) {
            hasRegularCardSelection = true;
            const selectedCards = selectCardsByType(type, count, state.cards.selected, cardCounts, false);
            regularDeck = regularDeck.concat(selectedCards);
        }
    });

    // Selecting Corrupter cards based on counts from inputs
    let hasSpecialCardSelection = false;
    allCardTypes.forEach(type => {
        if (corrupterCardTypes.includes(type) && isCorrupterEnabled) {
            const count = specialCardCounts[type];
            if (count > 0) {
                hasSpecialCardSelection = true;
                const selectedSpecialCards = selectCardsByType(type, count, state.cards.selected, specialCardCounts, true);
                specialDeck = specialDeck.concat(selectedSpecialCards);
            }
        }
    });

    // Selecting Sentry cards based on counts from inputs
    if (isSentryEnabled) {
        sentryDeck = []; // Reset sentry deck
        allCardTypes.forEach(type => {
            if (sentryCardTypes.includes(type)) {
                const count = sentryCardCounts[type];
                if (count > 0) {
                    const selectedSentryCards = selectCardsByType(type, count, state.cards.selected, sentryCardCounts, true);
                    sentryDeck = sentryDeck.concat(selectedSentryCards);
                }
            }
        });

        // Important: Sentry cards should NOT be added to the main deck yet
        // They will be introduced later via the introduceSentryCards action
        if (DEBUG) console.log(`Selected ${sentryDeck.length} Sentry cards for later introduction`);
    }

    // Selecting held back cards based on counts from inputs
    let selectedHeldBackCards = [];
    heldBackCardTypes.forEach(type => {
        const count = cardCounts[type];
        if (count > 0) {
            hasRegularCardSelection = true;
            const selectedCards = selectHeldBackCardsByType(type, count, state.cards.selected, cardCounts);
            selectedHeldBackCards = selectedHeldBackCards.concat(selectedCards);
        }
    });

    if (!hasRegularCardSelection && !hasSpecialCardSelection && sentryDeck.length === 0) {
        showToast('Please select at least one card type with a count greater than zero.');
        return;
    }

    // **Important Correction: Do NOT automatically include Sentry Cards here**
    // Sentry Cards should only be introduced via user action in applyCardAction()

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

    // 5. Shuffle the Entire Regular Deck
    regularDeck = shuffleDeck(regularDeck);

    // Combine regularDeck and specialDeck (Corrupter cards) for display
    currentDeck = regularDeck.concat(specialDeck);

    // Sync deck arrays with state for consistency
    state.deck.main = regularDeck;
    state.deck.special = specialDeck;
    state.deck.combined = currentDeck;

    // Set initial deck size
    state.initialDeckSize = currentDeck.length;

    // Save the current configuration
    saveConfiguration();

    // Log for debugging
    if (DEBUG) console.log('Selected Games:', selectedGames);
    if (DEBUG) console.log('Regular Card Counts:', cardCounts);
    if (DEBUG) console.log('Special Card Counts:', specialCardCounts);
    if (DEBUG) console.log('Sentry Deck:', sentryDeck);
    if (DEBUG) console.log('Available Cards:', availableCards);
    if (DEBUG) console.log('Generated Regular Deck:', regularDeck);
    if (DEBUG) console.log('Generated Special Deck:', specialDeck);
    if (DEBUG) console.log('Sentry Rules Enabled:', isSentryEnabled);
    if (DEBUG) console.log('Corrupter Rules Enabled:', isCorrupterEnabled);

    // After deck generation, make sure to show the active deck section
    const activeDeckSection = document.getElementById('activeDeckSection');
    if (activeDeckSection) {
        activeDeckSection.style.display = 'block';
    }

    // Display the deck
    displayDeck();

    // Show the Card Action section after deck generation
    const cardActionSection = document.getElementById('cardActionSection');
    if (cardActionSection) {
        cardActionSection.style.display = 'block';
    }

    // Show navigation buttons
    const navigationButtons = document.getElementById('navigationButtons');
    if (navigationButtons) {
        navigationButtons.style.display = 'block';
    }

    // Show the current card
    showCurrentCard();

    // Preload the first few upcoming cards
    preloadUpcomingCards();

    // Save configuration after generation
    saveConfiguration();

    // Track deck generation in analytics
    trackEvent('Deck', 'Generate', `Games: ${selectedGames.join(', ')}`, currentDeck.length);

    // Collapse the configuration sections (optional)
    ['gameCheckboxes', 'scenarioConfig', 'cardTypeSection'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const collapse = bootstrap.Collapse.getOrCreateInstance(el);
            collapse.hide();
        }
    });
}

// Function to select cards by type considering '+' and '/'
function selectCardsByType(cardType, count, selectedCardsMap, cardCounts, isSpecial = false) {
    let selectedCards = [];
    if (DEBUG) console.log(`Selecting ${count} cards for type: "${cardType}"`);

    // Get all available cards that could satisfy this type
    let cardsOfType = availableCards.filter(card => {
        const typeInfo = parseCardTypes(card.type);
        // Check if any of the card's types match the requested type
        return typeInfo.allTypes.includes(cardType);
    });

    if (DEBUG) console.log(`Found ${cardsOfType.length} potential cards for type "${cardType}"`);

    // Shuffle the candidate cards
    let shuffledCards = shuffleDeck([...cardsOfType]);

    // Try to select cards
    for (let card of shuffledCards) {
        if (selectedCards.length >= count) break;

        // Skip if card is already selected
        if (selectedCardsMap.has(card.id)) continue;

        // Check if we can select this card based on its type requirements
        const typeInfo = parseCardTypes(card.type);
        let canSelect = true;

        // For each AND group, we need to ensure we have enough count for at least one type in the OR options
        typeInfo.andGroups.forEach(orOptions => {
            let hasValidOption = orOptions.some(type => {
                if (type === cardType) return true; // This is the type we're selecting for
                return cardCounts[type] && cardCounts[type] > 0; // Check other required types
            });
            if (!hasValidOption) canSelect = false;
        });

        if (canSelect) {
            selectedCards.push(card);
            selectedCardsMap.set(card.id, true);

            // Decrease counts for required types
            typeInfo.andGroups.forEach(orOptions => {
                // Find the first available type in OR group and decrease its count
                for (let type of orOptions) {
                    if (cardCounts[type] && cardCounts[type] > 0) {
                        cardCounts[type]--;
                        if (DEBUG) console.log(`Decreased count for type "${type}" to ${cardCounts[type]}`);
                        break; // Only decrease one count per AND group
                    }
                }
            });

            if (DEBUG) console.log(`Selected card ID ${card.id}: "${card.card}"`);
        }
    }

    if (DEBUG) console.log(`Selected ${selectedCards.length} cards for type "${cardType}"`);
    return selectedCards;
}

// Function to select held back cards by type
function selectHeldBackCardsByType(cardType, count, selectedCardsMap, cardCounts) {
    let selectedCards = [];
    if (DEBUG) console.log(`Selecting ${count} held back cards for type: "${cardType}"`);

    // Get cards that can satisfy this type
    let cardsOfType = setAsideCards.filter(card => {
        const typeInfo = parseCardTypes(card.type);
        return typeInfo.allTypes.includes(cardType);
    });

    if (DEBUG) console.log(`Available held back cards for type "${cardType}":`, cardsOfType);

    // Shuffle cardsOfType
    let shuffledCards = shuffleDeck(cardsOfType);
    if (DEBUG) console.log(`Shuffled held back cards for type "${cardType}":`, shuffledCards);

    for (let card of shuffledCards) {
        if (selectedCards.length >= count) break;

        const cardId = card.id;
        if (selectedCardsMap.has(cardId)) {
            if (DEBUG) console.log(`Card ID ${cardId} already selected.`);
            continue;
        }

        selectedCards.push(card);
        selectedCardsMap.set(cardId, true);
        cardCounts[cardType]--;
        if (DEBUG) console.log(`Selected held back card ID ${cardId} for type "${cardType}". New count: ${cardCounts[cardType]}.`);
    }

    if (DEBUG) console.log(`Selected Held Back Cards for type "${cardType}":`, selectedCards);
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


// Function to reset availableCards without affecting the DOM
function resetAvailableCards() {
    // Flatten cards from selected games
    let allCards = [];
    selectedGames.forEach(game => {
        if (dataStore.games[game]) {
            allCards = allCards.concat(dataStore.games[game]);
        }
    });

    // Copy allCards to availableCards (Always include all cards, excluding held back cards)
    availableCards = [...allCards];
    if (DEBUG) console.log('Available Cards after reset:', availableCards);
}

// ============================
// 8. Deck Display and Navigation Functions
// ============================

// Function to display the current card
function showCurrentCard(direction = null) {
    const output = document.getElementById('deckOutput');
    const cardActionSection = document.getElementById('cardActionSection');

    if (!output) return;

    // Ensure card actions are available
    if (cardActionSection) {
        cardActionSection.style.display = 'block';
        updateCardActionSelect();
    }

    // Show back of card if index is -1
    if (currentIndex === -1) {
        output.innerHTML = `<img src="cardimages/back.jpg" alt="Card Back" class="img-fluid">`;
    } else {
        // Show current card
        const currentCard = currentDeck[currentIndex];
        if (currentCard) {
            output.innerHTML = `<img src="cardimages/${currentCard.contents}" alt="${currentCard.card}" class="img-fluid">`;
        }
    }

    const clearBtn = document.getElementById('clearActiveCard');
    if (clearBtn) {
        clearBtn.style.display = currentIndex >= 0 ? 'block' : 'none';
    }

    const img = output.querySelector('img');
    if (direction && img) {
        const className = direction === 'forward' ? 'flip-forward' : 'flip-backward';
        img.classList.add(className);
        img.addEventListener('animationend', () => {
            img.classList.remove(className);
        }, { once: true });
    }

    // Always update the progress bar
    updateProgressBar();

    // Save current state
    debouncedSaveConfiguration();

    // Preload upcoming card images for smoother navigation
    preloadUpcomingCards();
}

// Function to preload upcoming card images
function preloadUpcomingCards(count = 2) {
    for (let i = 1; i <= count; i++) {
        const index = currentIndex + i;
        if (index >= 0 && index < currentDeck.length) {
            const card = currentDeck[index];
            if (card && card.contents) {
                const img = new Image();
                img.src = `cardimages/${card.contents}`;
            }
        }
    }
}

// Function to display the deck
function displayDeck() {
    const output = document.getElementById('deckOutput');
    const navButtons = document.getElementById('navigationButtons');
    const deckProgress = document.getElementById('deckProgress');
    const cardActionSection = document.getElementById('cardActionSection');

    if (!output || !navButtons || !deckProgress) {
        console.error('One or more required elements for deck display are missing.');
        return;
    }

    if (currentDeck.length === 0) {
        output.innerHTML = '<p>No cards selected.</p>';
        navButtons.style.display = 'none';
        deckProgress.style.display = 'none';
        if (cardActionSection) cardActionSection.style.display = 'none';
        toggleDeckBuilderUI(false);
    } else {
        // Show navigation and progress elements
        navButtons.style.display = 'block';
        deckProgress.style.display = 'block';
        if (cardActionSection) {
            cardActionSection.style.display = 'block';
            updateCardActionSelect(); // Ensure card actions are properly initialized
        }

        // Initialize progress bar
        updateProgressBar();

        // Show current card
        showCurrentCard();

        // Collapse deck builder UI
        toggleDeckBuilderUI(true);
    }
}

// Function to update the progress bar
function updateProgressBar() {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    if (!progressBar || !progressText) {
        console.error('Progress bar elements not found.');
        return;
    }

    // Calculate total cards in active pool (not including the back card)
    let totalCards = currentDeck.length;

    // Calculate current position
    let currentCardNumber;
    if (currentIndex === -1) {
        // When showing the back card, we're at position 0
        currentCardNumber = 0;
        progressText.textContent = `Card Back`;
    } else {
        // For actual cards, count from 1
        currentCardNumber = currentIndex + 1;
        progressText.textContent = `Card ${currentCardNumber} of ${totalCards}`;
    }

    // Calculate progress percentage (only if we have cards)
    let progressPercentage = 0;
    if (totalCards > 0) {
        if (currentIndex === -1) {
            progressPercentage = 0; // At the back card, progress is 0%
        } else {
            progressPercentage = (currentCardNumber / totalCards) * 100;
        }
    }

    // Update progress bar
    progressBar.style.width = `${progressPercentage}%`;
    progressBar.setAttribute('aria-valuenow', progressPercentage.toFixed(0));

    // Log for debugging
    if (DEBUG) console.log('Progress Update:', {
        currentIndex: currentIndex,
        currentCardNumber: currentCardNumber,
        totalCards: totalCards,
        deckLength: currentDeck.length,
        percentage: progressPercentage
    });
}

// Function to advance to the next card (used by button and card click)
function advanceToNextCard() {
    // Move the current card to the discard pile if it's not the starting card back
    if (currentIndex >= 0 && currentIndex < currentDeck.length) {
        discardPile.push(currentDeck[currentIndex]);
    }

    currentIndex++;
    state.currentIndex = currentIndex;

    if (currentIndex >= currentDeck.length) {
        if (discardPile.length > 0) {
            // Reshuffle the discard pile to form a new deck
            currentDeck = shuffleDeck(discardPile);
            state.initialDeckSize = currentDeck.length;
            discardPile = [];
            currentIndex = -1; // Reset to start of new deck
            state.currentIndex = currentIndex;
            showToast('Deck reshuffled from discard pile.');
            trackEvent('Navigation', 'Reshuffle Deck', `Cards: ${state.initialDeckSize}`);
        } else {
            // No more cards left to draw
            showToast('No more cards in the deck.');
            currentIndex--; // Stay at the last card
            state.currentIndex = currentIndex;
            return;
        }
    }

    showCurrentCard('forward');
    updateProgressBar();
    debouncedSaveConfiguration();
    trackEvent('Navigation', 'Next Card', `Index: ${currentIndex}`);
}

// ============================
// 9. Card Action Functions
// ============================

// Function to check if a card is already in play
function isCardInPlay(card) {
    return state.deck.inPlay.some(inPlayCard => inPlayCard.id === card.id);
}

// Function to mark a card as in play
function markCardAsInPlay(card) {
    if (!isCardInPlay(card)) {
        state.deck.inPlay.push(card);
        updateInPlayCardsDisplay();
        showToast(`Card "${card.card}" marked as in play.`);
        saveConfiguration();
        trackEvent('Card Status', 'Mark In Play', card.card);
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

    if (state.deck.inPlay.length === 0) {
        inPlayContainer.innerHTML = '<p>No cards in play.</p>';
        inPlaySection.style.display = 'none';
        return;
    }

    inPlaySection.style.display = 'block';
    state.deck.inPlay.forEach(card => {
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
}

// Function to remove a card from play
function removeCardFromPlay(card) {
    state.deck.inPlay = state.deck.inPlay.filter(inPlayCard => inPlayCard.id !== card.id);
    updateInPlayCardsDisplay();
    showToast(`Card "${card.card}" removed from play.`);
    saveConfiguration();
}

// Function to clear all in-play cards
function clearInPlayCards() {
    state.deck.inPlay = [];
    updateInPlayCardsDisplay();
    showToast('All in-play cards have been cleared.');
    saveConfiguration();
}

// Function to clear the currently displayed card
function clearActiveCard() {
    currentIndex = -1;
    state.currentIndex = currentIndex;
    showCurrentCard();
    debouncedSaveConfiguration();
}

// ============================
// 10. Deck Restoration and Helper Functions
// ============================

// Function to find a card by its ID
function findCardById(id) {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    const card = cardMap.get(numericId);
    if (card) {
        return card;
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
            if (DEBUG) console.log('Corrupter Rules Enabled:', corrupterRulesCheckbox.checked);
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

// 3. Consolidate card action handlers
const cardActions = {
    shuffleAnywhere: (card) => {
        const cardId = card.id;

        // 1. Remove the card from currentDeck.
        // currentDeck[currentIndex] now points to the card that used to be before it.
        currentDeck.splice(currentIndex, 1);

        // (Original state.deck.main/special manipulation removed here)

        // 2. Determine the insertion range within the "remaining undrawn cards" of currentDeck.
        const numElementsInRemainingPortion = currentDeck.length - currentIndex;
        let randomOffsetInRemaining = (numElementsInRemainingPortion < 0) ? 0 : Math.floor(Math.random() * (numElementsInRemainingPortion + 1));

        const insertIdxInCurrentDeck = currentIndex + randomOffsetInRemaining;
        currentDeck.splice(insertIdxInCurrentDeck, 0, card);

        // 3. Synchronize derived deck states
        synchronizeDeckState();

        // 4. Reveal the previous card in the sequence.
        if (currentIndex > 0) {
            currentIndex--;
        }
        state.currentIndex = currentIndex; // Sync state with the global currentIndex.

        showCurrentCard('backward');
        saveConfiguration();

        return `Card "${card.card}" shuffled back into the deck.`;
    },

    shuffleTopN: (card, n) => {
        if (n <= 0) return 'Please enter a valid number for N.';

        const remaining = currentDeck.length - (currentIndex + 1);
        if (remaining <= 0) return 'No cards ahead to shuffle into.';

        // Limit N to the number of cards actually remaining
        n = Math.min(n, remaining);

        // Remove the card from the current deck
        currentDeck.splice(currentIndex, 1);
        // (Original state.deck.main manipulation removed here)

        // Determine a random position within the next N cards
        const sliceStart = currentIndex; // This is the index of the *first* of the "next N cards"
        const insertIdx = sliceStart + Math.floor(Math.random() * (n + 1));

        currentDeck.splice(insertIdx, 0, card);

        // Synchronize derived deck states
        synchronizeDeckState();

        // Reveal the next card and update progress
        // currentIndex already points to the correct card to reveal.
        state.currentIndex = currentIndex; // Ensure state reflects global
        showCurrentCard();
        updateProgressBar();
        saveConfiguration();

        return `Card "${card.card}" shuffled into the next ${n} cards.`;
    },

    replaceSameType: (card) => {
        // Extract the card's types
        const typeInfo = parseCardTypes(card.type);
        const cardTypes = typeInfo.allTypes;

        // Find all available cards of the same type that aren't already in the deck
        const availableReplacements = availableCards.filter(availableCard => {
            // Skip if it's the same card or already selected in the deck
            if (availableCard.id === card.id) return false;
            if (state.cards.selected.has(availableCard.id)) return false;

            // Check if the card has at least one matching type
            const availableTypeInfo = parseCardTypes(availableCard.type);
            return availableTypeInfo.allTypes.some(type => cardTypes.includes(type));
        });

        if (availableReplacements.length === 0) {
            return `No available cards of type "${cardTypes.join(', ')}" to replace with.`;
        }

        // Select a random replacement
        const replacement = availableReplacements[Math.floor(Math.random() * availableReplacements.length)];

        // Replace the current card with the replacement
        currentDeck[currentIndex] = replacement;

        // Update selected cards map
        state.cards.selected.delete(card.id);
        state.cards.selected.set(replacement.id, true);

        // Synchronize derived deck states
        synchronizeDeckState();

        // state.currentIndex does not change for this action.
        // showCurrentCard() will be called by applyCardAction after this.
        // saveConfiguration() will be called by applyCardAction after this.

        return `Card "${card.card}" replaced with "${replacement.card}".`;
    },

    introduceSentry: () => {
        if (introduceSentryCards()) {
            return 'Sentry cards have been introduced into the remaining deck.';
        }
        return 'Failed to introduce Sentry cards.';
    },

    insertCardType: () => {
        const cardType = document.getElementById('insertCardType')?.value;
        const position = document.getElementById('insertPosition')?.value || 'next';

        if (!cardType) {
            return 'Please select a card type to insert.';
        }

        const result = insertCardOfType(cardType, position);
        if (result) {
            return `New ${cardType} card inserted.`;
        }
        return 'Failed to insert card.';
    }
};

function applyCardAction() {
    const action = document.getElementById('cardAction').value;
    if (!action) {
        showToast('Please select an action.');
        return;
    }

    // For all actions except insertCardType, we need a current card
    if (action !== 'insertCardType' && currentIndex === -1) {
        showToast('No active card to perform action on.');
        return;
    }

    // Handle insertCardType separately as it doesn't need a current card
    if (action === 'insertCardType') {
        const result = cardActions[action](); // This calls the method in cardActions, which then calls insertCardOfType
        // The actual insertCardOfType function handles its own toast, save, etc.
        // So, we might not need to duplicate displayDeck/saveConfiguration here if insertCardOfType handles it.
        // Let's check insertCardOfType: it does call showToast, updateProgressBar, saveConfiguration.
        // So, the 'if (result)' block here for 'insertCardType' might be redundant if the messages are consistent.
        // For now, let's assume cardActions.insertCardType returns the message string, and applyCardAction shows it.
        if (typeof result === 'string' && (result.includes("inserted") || result.includes("Failed"))) { // Check if it's a message from the action
             showToast(result); // Show the message from insertCardOfType
        }
        // displayDeck, updateInPlayCardsDisplay, saveConfiguration are called inside insertCardOfType if successful.
        // No, they are not. insertCardOfType returns true/false.
        // The message is constructed in cardActions.insertCardType.
        // Let's re-verify the flow for insertCardType.
        // cardActions.insertCardType -> calls insertCardOfType.
        // insertCardOfType (if successful) calls showToast, updateProgressBar, saveConfiguration.
        // cardActions.insertCardType returns a message string.
        // applyCardAction then shows this message string using showToast. This is duplicative toast.

        // Corrected flow for insertCardType in applyCardAction:
        // The cardActions.insertCardType itself returns the message.
        // insertCardOfType performs the actual work *including* toasts and saves.
        // So applyCardAction should just call it and trust it.
        // The `result` from `cardActions[action]()` for `insertCardType` is the string message.
        // `insertCardOfType` returns true/false.

        // Let's simplify: `cardActions.insertCardType` should just do the work or call `insertCardOfType` which does the work.
        // `applyCardAction` then just handles the generic success/failure display for other actions.

        // Current structure:
        // applyCardAction -> cardActions.insertCardType() -> insertCardOfType()
        // insertCardOfType() calls showToast, updateProgressBar, saveConfiguration.
        // cardActions.insertCardType() returns a string like "New X card inserted." or "Failed..."
        // applyCardAction then calls showToast(result) again if it's insertCardType. This is a double toast.

        // Simplest fix for applyCardAction regarding insertCardType:
        // cardActions.insertCardType already calls insertCardOfType, which handles its own UI updates and save.
        // So, for insertCardType, applyCardAction doesn't need to do much with the result string other than perhaps logging.
        // The toast is already handled.

        // Let cardActions.insertCardType return true/false based on insertCardOfType's result.
        // And let insertCardOfType handle its own user feedback.
        // This means the `if (result)` block for insertCardType in `applyCardAction` is mostly not needed for UI.

        // For now, the existing structure in applyCardAction for insertCardType will cause a double toast.
        // This is outside the scope of the current bug fix for insertCardOfType's internal logic.
        // The original request was to fix insertCardOfType.
        if (result) { // `result` is the message string from `cardActions.insertCardType`
            showToast(result); // This is the potentially double toast.
            // displayDeck(); // These are called by insertCardOfType itself.
            // updateInPlayCardsDisplay();
            // saveConfiguration();
        }
        return; // Return because insertCardOfType handles its own save & UI for deck.
    }

    // For all other actions
    const activeCard = currentDeck[currentIndex];
    const n = parseInt(document.getElementById('actionN')?.value) || 0;

    const result = cardActions[action]?.(activeCard, n);
    if (result) {
        showToast(result);
        displayDeck();
        updateInPlayCardsDisplay();
        saveConfiguration();

        let actionDetails = activeCard ? activeCard.card : 'Unknown Card';
        if (action === 'shuffleTopN') {
            actionDetails += ` (N=${n})`;
        }
        trackEvent('Card Action', action, actionDetails);
    }
}

// ============================
// 13. Helper Functions
// ============================

// Function to synchronize state.deck.main, state.deck.special, and state.deck.combined with global currentDeck
function synchronizeDeckState() {
    state.deck.main = [];
    state.deck.special = [];

    const corrupterRulesEnabled = document.getElementById('enableCorrupterRules')?.checked || false;

    currentDeck.forEach(card => {
        const typeInfo = parseCardTypes(card.type);
        let isSpecialCard = false;
        if (corrupterRulesEnabled) {
            isSpecialCard = typeInfo.allTypes.some(type => corrupterCardTypes.includes(type));
        }

        if (isSpecialCard) {
            state.deck.special.push(card);
        } else {
            // Includes regular cards and Sentry cards once they are in currentDeck
            state.deck.main.push(card);
        }
    });

    state.deck.combined = [...currentDeck];
    if (DEBUG) console.log('Deck state synchronized:', { main: state.deck.main.length, special: state.deck.special.length, combined: state.deck.combined.length });
}

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
    closeButton.classList.add('ms-auto', 'mb-1', 'btn-close');
    closeButton.setAttribute('data-bs-dismiss', 'toast');
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.innerHTML = '<span aria-hidden="true">&times;</span>';
    toastBody.appendChild(closeButton);

    toast.appendChild(toastBody);
    toastContainer.appendChild(toast);

    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    setTimeout(() => {
        bsToast.hide();
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }, 3000);
}

// Function to track events in Google Analytics
function trackEvent(eventCategory, eventAction, eventLabel = null, eventValue = null) {
    if (typeof gtag !== 'function') {
        console.warn('Google Analytics not available');
        return;
    }

    const eventParams = {
        event_category: eventCategory,
        event_label: eventLabel,
        value: eventValue,
        stream_id: '9783920401',
        stream_name: 'Maladum Event Cards'
    };

    // Remove undefined properties
    Object.keys(eventParams).forEach(key =>
        eventParams[key] === null && delete eventParams[key]
    );

    // Send the event to Google Analytics
    gtag('event', eventAction, eventParams);
    if (DEBUG) console.log('GA Event:', eventAction, eventParams);
}

// Function to enhance buttons (e.g., tooltips)
function enhanceButtons() {
    // Initialize any tooltips or other UI enhancements here
    document.querySelectorAll('[data-toggle="tooltip"], [data-bs-toggle="tooltip"]').forEach(el => {
        new bootstrap.Tooltip(el);
    });
}

// Function to toggle Sentry Rules options
function toggleSentryRulesOptions() {
    // Handle UI changes if necessary when Sentry Rules are toggled
    // For example, show/hide certain sections or inputs
    // Currently, no additional UI changes are defined
}

// ============================
// 14. Additional Helper Functions
// ============================

// Function to select card actions based on user selection
// Implemented as part of applyCardAction()

// ============================
// 15. End of deckbuilder.js
// ============================

// Add this function to help with debugging
function debugConfiguration() {
    const savedConfig = localStorage.getItem('savedConfig');
    if (DEBUG) console.log('Current localStorage savedConfig:', savedConfig ? JSON.parse(savedConfig) : 'No saved config');
    if (DEBUG) console.log('Current selectedGames:', selectedGames);
    if (DEBUG) console.log('Current deck size:', currentDeck.length);
    if (DEBUG) console.log('Current index:', currentIndex);
}

// Function to toggle deck builder UI based on active deck
function toggleDeckBuilderUI(isDeckActive) {
    const deckBuilderControls = document.getElementById('deckBuilderControls');
    const collapseButton = document.getElementById('collapseButton');

    if (!deckBuilderControls) {
        console.error('Element with ID "deckBuilderControls" not found.');
        return;
    }

    if (isDeckActive) {
        // Add collapse/expand button if it doesn't exist
        if (!collapseButton) {
            const button = document.createElement('button');
            button.id = 'collapseButton';
            button.className = 'btn btn-secondary mb-3';
            button.innerHTML = '<i class="fas fa-chevron-up"></i> Deck Builder Options';
            button.onclick = () => {
                const isCollapsed = deckBuilderControls.classList.contains('collapsed');
                deckBuilderControls.classList.toggle('collapsed');
                button.innerHTML = isCollapsed ?
                    '<i class="fas fa-chevron-up"></i> Deck Builder Options' :
                    '<i class="fas fa-chevron-down"></i> Show Deck Builder';

                // Save collapse state
                const config = JSON.parse(localStorage.getItem('savedConfig') || '{}');
                config.isBuilderCollapsed = !isCollapsed;
                localStorage.setItem('savedConfig', JSON.stringify(config));
            };
            deckBuilderControls.parentNode.insertBefore(button, deckBuilderControls);
        }

        // Add collapsed class to hide the controls
        deckBuilderControls.classList.add('collapsed');
        if (collapseButton) {
            collapseButton.innerHTML = '<i class="fas fa-chevron-down"></i> Show Deck Builder';
        }
    } else {
        // Remove collapsed class to show the controls
        deckBuilderControls.classList.remove('collapsed');
        if (collapseButton) {
            collapseButton.innerHTML = '<i class="fas fa-chevron-up"></i> Deck Builder Options';
        }
    }
}

// Add CSS for collapsed state
const style = document.createElement('style');
style.textContent = `
    #deckBuilderControls.collapsed {
        display: none;
    }

    #collapseButton {
        width: 100%;
        text-align: left;
        margin-bottom: 1rem;
    }

    #collapseButton i {
        margin-right: 0.5rem;
    }
`;
document.head.appendChild(style);

// Enhanced Corrupter handling function
function handleCorrupterRules(regularDeck) {
    if (!document.getElementById('enableCorrupterRules').checked) {
        return regularDeck;
    }

    const corrupterCards = availableCards.filter(card => {
        let cardTypes = parseCardTypes(card.type);
        return cardTypes.allTypes.some(type => corrupterCardTypes.includes(type));
    });

    if (corrupterCards.length === 0) {
        showToast('No Corrupter cards available.');
        return regularDeck;
    }

    const deckSize = regularDeck.length;
    const numCorrupterCards = Math.min(GAME_CONFIG.corrupter.defaultCount, deckSize, corrupterCards.length);

    // Generate positions based on preferred deck section
    let positions = [];
    switch (GAME_CONFIG.corrupter.preferredDeckSection) {
        case 'start':
            positions = Array.from({length: numCorrupterCards}, (_, i) => i);
            break;
        case 'end':
            positions = Array.from({length: numCorrupterCards}, (_, i) => deckSize - 1 - i);
            break;
        case 'middle':
            const startPos = Math.floor((deckSize - numCorrupterCards) / 2);
            positions = Array.from({length: numCorrupterCards}, (_, i) => startPos + i);
            break;
        case 'random':
        default:
            while (positions.length < numCorrupterCards) {
                const pos = Math.floor(Math.random() * deckSize);
                if (!positions.includes(pos)) {
                    positions.push(pos);
                }
            }
    }

    // Sort positions in descending order
    positions.sort((a, b) => b - a);

    // Replace cards with Corrupters
    let corruptersAdded = 0;
    positions.forEach(pos => {
        const availableCorrupters = corrupterCards.filter(card => !state.cards.selected.has(card.id));
        if (availableCorrupters.length > 0) {
            const corrupterCard = availableCorrupters[Math.floor(Math.random() * availableCorrupters.length)];
            state.cards.selected.set(corrupterCard.id, true);
            regularDeck[pos] = corrupterCard;
            corruptersAdded++;
        }
    });

    showToast(`Added ${corruptersAdded} Corrupter cards to the deck.`);
    return regularDeck;
}

// Function to handle Sentry rules when generating the deck
function handleSentryRules(regularDeck) {
    if (!document.getElementById('enableSentryRules').checked) {
        return regularDeck;
    }

    // Get all available Sentry cards (cards with types Revenant or Malagaunt)
    const sentryCards = availableCards.filter(card => {
        let cardTypes = parseCardTypes(card.type);
        return cardTypes.allTypes.some(type => sentryCardTypes.includes(type));
    });

    if (sentryCards.length === 0) {
        showToast('No Sentry cards available.');
        return regularDeck;
    }

    // Create a separate deck for Sentry cards
    sentryDeck = [];

    // Select random Sentry cards that haven't been used yet
    for (let card of shuffleDeck([...sentryCards])) {
        if (state.cards.selected.has(card.id)) continue;
        sentryDeck.push(card);
        state.cards.selected.set(card.id, true);

        if (sentryDeck.length >= GAME_CONFIG.sentry.defaultCount) break;
    }

    showToast(`${sentryDeck.length} Sentry cards ready to be introduced.`);
    return regularDeck;
}

// Function to introduce Sentry cards into the deck - unchanged
function introduceSentryCards() {
    if (sentryDeck.length === 0) {
        showToast('No Sentry cards available to introduce.');
        return false;
    }

    // Calculate remaining cards in the deck
    const remainingCards = currentDeck.slice(currentIndex + 1);

    // if (remainingCards.length === 0) { // Removed this overly restrictive check
    //     showToast('No cards remaining to introduce Sentry cards.');
    //     return false;
    // }

    // Create a copy of the Sentry cards to introduce
    const sentryCardsToAdd = [...sentryDeck];

    // Shuffle Sentry cards into the remaining deck
    const updatedRemainingCards = shuffleDeck([...remainingCards, ...sentryCardsToAdd]);

    // Update the current deck
    currentDeck = [
        ...currentDeck.slice(0, currentIndex + 1),
        ...updatedRemainingCards
    ];

    // CRITICAL FIX: Rebuild state.deck.main and state.deck.special from the new currentDeck
    synchronizeDeckState();

    // Clear the Sentry deck as it's now been used
    const sentryCount = sentryDeck.length;
    sentryDeck = [];

    showToast(`Introduced ${sentryCount} Sentry cards into the remaining deck.`);
    updateProgressBar();
    saveConfiguration();
    return true;
}

// Add to the card action select options in HTML
function updateCardActionSelect() {
    const cardAction = document.getElementById('cardAction');
    if (!cardAction) {
        console.error('Card action select not found');
        return;
    }

    cardAction.innerHTML = `
        <option value="">Select an action...</option>
        <option value="shuffleAnywhere">Shuffle into remaining deck</option>
        <option value="shuffleTopN">Shuffle into next N cards</option>
        <option value="replaceSameType">Replace with same type</option>
        <option value="introduceSentry">Introduce Sentry cards</option>
        <option value="insertCardType">Insert card by type</option>
    `;
}

// Update the card action change handler
document.getElementById('cardAction').addEventListener('change', function() {
    const actionTopNInput = document.getElementById('actionTopNInput');
    const cardTypeInsertUI = document.getElementById('cardTypeInsertUI');
    const applyActionButton = document.getElementById('applyCardAction');

    // Remove existing card type insert UI if it exists
    if (cardTypeInsertUI) {
        cardTypeInsertUI.remove();
    }

    // Hide apply button by default
    if (applyActionButton) {
        applyActionButton.style.display = 'none';
    }

    // If no action is selected, hide everything
    if (!this.value) {
        if (actionTopNInput) actionTopNInput.style.display = 'none';
        return;
    }

    // Show apply button when an action is selected
    if (applyActionButton) {
        applyActionButton.style.display = 'block';
    }

    switch (this.value) {
        case 'shuffleTopN':
            actionTopNInput.style.display = 'block';
            break;
        case 'insertCardType':
            showCardTypeInsertUI();
            actionTopNInput.style.display = 'none';
            break;
        default:
            actionTopNInput.style.display = 'none';
            break;
    }
});

// Update showCardTypeInsertUI to show specific cards
function showCardTypeInsertUI() {
    const actionTopNInput = document.getElementById('actionTopNInput');
    let cardTypeSelect = document.getElementById('cardTypeInsertUI');

    // Remove existing UI if it exists
    if (cardTypeSelect) {
        cardTypeSelect.remove();
    }

    cardTypeSelect = document.createElement('div');
    cardTypeSelect.id = 'cardTypeInsertUI';
    cardTypeSelect.className = 'mt-3';

    // Get unique card types from available cards
    const cardTypes = [...new Set(
        availableCards.flatMap(card => parseCardTypes(card.type).allTypes)
    )].sort();

    cardTypeSelect.innerHTML = `
        <div class="form-group">
            <label for="insertCardType">Select Card Type:</label>
            <select id="insertCardType" class="form-control form-control-lg">
                <option value="">Select a type...</option>
                ${cardTypes.map(type => `<option value="${type}">${type}</option>`).join('')}
            </select>
        </div>
        <div class="form-group mt-3" id="specificCardSelect" style="display: none;">
            <label for="insertSpecificCard">Select Specific Card:</label>
            <select id="insertSpecificCard" class="form-control form-control-lg">
                <option value="">Select a card...</option>
            </select>
        </div>
        <div class="form-group mt-3">
            <label for="insertPosition">Insert Position:</label>
            <select id="insertPosition" class="form-control form-control-lg">
                <option value="next">Next Card</option>
                <option value="random">Random Position</option>
                <option value="bottom">Bottom of Deck</option>
            </select>
        </div>
    `;

    // Insert the UI after the action select
    actionTopNInput.parentNode.insertBefore(cardTypeSelect, actionTopNInput);

    // Add event listener for card type selection
    const cardTypeDropdown = cardTypeSelect.querySelector('#insertCardType');
    cardTypeDropdown.addEventListener('change', function() {
        const specificCardSelect = document.getElementById('specificCardSelect');
        const specificCardDropdown = document.getElementById('insertSpecificCard');

        if (!this.value) {
            specificCardSelect.style.display = 'none';
            return;
        }

        // Get available cards of the selected type
        const availableCardsOfType = availableCards.filter(card => {
            const cardTypes = parseCardTypes(card.type).allTypes;
            return cardTypes.includes(this.value);
        });

        // Update specific card dropdown
        specificCardDropdown.innerHTML = `
            <option value="">Random ${this.value}</option>
            ${availableCardsOfType.map(card =>
                `<option value="${card.id}">${card.card}</option>`
            ).join('')}
        `;

        specificCardSelect.style.display = 'block';
    });
}

// Update insertCardOfType to handle specific card selection
function insertCardOfType(cardType, position) {
    const specificCardId = document.getElementById('insertSpecificCard').value;
    let selectedCard;

    if (specificCardId) {
        // Use specifically selected card
        selectedCard = findCardById(specificCardId);
        if (!selectedCard) {
            showToast('Selected card not found.');
            return false;
        }
        // Skip if the card is already in the deck
        if (state.cards.selected.has(selectedCard.id)) {
            showToast('Card is already in the current deck.');
            return false;
        }
    } else {
        // Get random card of the selected type
        const availableCardsOfType = availableCards.filter(card => {
            const currentCardTypes = parseCardTypes(card.type).allTypes;
            return currentCardTypes.includes(cardType) && !state.cards.selected.has(card.id);
        });

        if (availableCardsOfType.length === 0) {
            showToast(`No unused ${cardType} cards available to insert.`);
            return false;
        }

        selectedCard = availableCardsOfType[Math.floor(Math.random() * availableCardsOfType.length)];
    }

    let insertIndex = currentIndex + 1;

    switch (position) {
        case 'next':
            // insertIndex is already currentIndex + 1
            break;
        case 'random':
            const numSlotsInRemaining = (currentDeck.length - (currentIndex + 1)) + 1;
            if (numSlotsInRemaining <= 0 && currentDeck.length > 0) {
                 insertIndex = currentDeck.length;
            } else if (currentDeck.length === 0) {
                 insertIndex = 0;
            }
            else {
                 const offset = Math.floor(Math.random() * numSlotsInRemaining);
                 insertIndex = (currentIndex + 1) + offset;
            }
            break;
        case 'bottom':
            insertIndex = currentDeck.length;
            break;
    }

    currentDeck.splice(insertIndex, 0, selectedCard);
    state.cards.selected.set(selectedCard.id, true); // Mark selected card as used

    // Synchronize derived deck states
    synchronizeDeckState();

    showToast(`Inserted ${selectedCard.card} into the deck.`);
    updateProgressBar();
    saveConfiguration();
    return true;
}

// Add this to handle dark theme consistency
function applyDarkTheme() {
    // Add custom select styling
    const selects = document.querySelectorAll('select');
    selects.forEach(select => {
        select.classList.add('form-control-dark');
    });

    // Add button hover effects
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.classList.add('btn-hover-effect');
    });
}

function loadSavedConfig() {
    if (!storageUtils.isStorageAvailable()) {
        console.warn('Storage is not available, using default configuration');
        return null;
    }

    try {
        const savedConfig = localStorage.getItem(CONFIG.storage.key);
        return savedConfig ? JSON.parse(savedConfig) : null;
    } catch (e) {
        console.warn('Error loading saved configuration:', e);
        return null;
    }
}

// Add this function to handle number input adjustments
function setupNumberInputs() {
    document.querySelectorAll('.input-group').forEach(group => {
        const input = group.querySelector('input[type="number"]');
        const minusBtn = group.querySelector('.btn-minus');
        const plusBtn = group.querySelector('.btn-plus');

        if (input && minusBtn && plusBtn) {
            // Minus button click handler
            minusBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const currentValue = parseInt(input.value) || 0;
                const minValue = parseInt(input.min) || 0;
                if (currentValue > minValue) {
                    input.value = currentValue - 1;
                    input.dispatchEvent(new Event('change'));
                }
            });

            // Plus button click handler
            plusBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const currentValue = parseInt(input.value) || 0;
                const maxValue = parseInt(input.max);
                if (!maxValue || currentValue < maxValue) {
                    input.value = currentValue + 1;
                    input.dispatchEvent(new Event('change'));
                }
            });

            // Touch event handlers for better mobile response
            minusBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                minusBtn.click();
            });

            plusBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                plusBtn.click();
            });
        }
    });
}

// Add this function near the top of the file, after dataStore initialization
function restoreSavedState(savedConfig) {
    if (!storageUtils.isStorageAvailable() || !savedConfig) return;

    try {
        // Restore card counts from the savedConfig parameter
        if (savedConfig.cardCounts) {
            Object.keys(savedConfig.cardCounts).forEach(cardType => {
                const input = document.getElementById(`type-${cardType}`);
                if (input) {
                    input.value = savedConfig.cardCounts[cardType];
                }
            });
        }

        // Restore difficulty selection if it exists
        if (savedConfig.selectedDifficultyIndex !== undefined) {
            const difficultySelect = document.getElementById('difficultyLevel');
            if (difficultySelect) {
                difficultySelect.selectedIndex = savedConfig.selectedDifficultyIndex;
                updateDifficultyDetails();
            }
        }
    } catch (error) {
        console.warn('Error restoring saved state:', error);
    }
}

// Use this check before any localStorage operations
