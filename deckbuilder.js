// deckbuilder.js for Deck Builder Application

// Register the Service Worker for PWA functionality
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
                console.log('Service Worker registration failed:', err);
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

let deckDataByType = {}; // Cards grouped by type
let regularDeck = [];    // Generated regular deck
let sentryDeck = [];     // Generated sentry deck
let currentDeck = [];    // Combined deck for display
let currentIndex = -1;   // Current card index (-1 to start with back.jpg)
let allGames = [];       // List of all games
let allCardTypes = [];   // List of all card types
let selectedGames = [];  // Selected games
let dataStore = {};      // Store data for access in functions
let availableCards = []; // Global array of available cards
let difficultySettings = []; // Store difficulty settings

// Define Sentry card types
const sentryCardTypes = ['Revenants', 'Revenant', 'Malagaunt'];

// Enable dark mode by default
document.body.classList.add('dark-mode');

// Fetch the JSON files and load the data
Promise.all([
    fetch('maladumcards.json').then(response => response.json()),
    fetch('difficulties.json').then(response => response.json())
])
.then(([cardsData, difficultiesData]) => {
    dataStore = cardsData; // Store cards data
    difficultySettings = difficultiesData.difficulties; // Store difficulty settings

    // Get all games (categories)
    allGames = Object.keys(dataStore);

    // Generate game selection checkboxes
    generateGameSelection(allGames);

    // Populate the difficulty selection dropdown
    populateDifficultySelection();

    // Load configuration if exists
    loadConfiguration();

    // Event listener for game selection changes
    document.getElementById('gameCheckboxes').addEventListener('change', (event) => {
        if (event.target && event.target.matches('input[type="checkbox"]')) {
            loadCardTypes();
            saveConfiguration(); // Automatically save configuration when games are selected/deselected
        }
    });

    // Event listener for difficulty selection changes
    document.getElementById('difficultyLevel').addEventListener('change', () => {
        updateDifficultyDetails();
        // Optionally, inform the user that counts have been reset
        showToast('Novice and Veteran card counts have been updated based on the selected difficulty.');
    });

    // Event listener for Sentry Rules checkbox
    document.getElementById('enableSentryRules').addEventListener('change', () => {
        toggleSentryRulesOptions();
        saveConfiguration(); // Save configuration when Sentry Rules option changes
    });

    // Initial load of card types based on selected games
    loadCardTypes(); // Now that selectedGames is set

    // After card types are loaded, restore card counts
    restoreCardCounts();

    // Enhance buttons after DOM content is loaded
    enhanceButtons();
})
.catch(error => console.error('Error loading the JSON files:', error));

// Function to generate game selection checkboxes
function generateGameSelection(games) {
    const gameCheckboxes = document.getElementById('gameCheckboxes');
    gameCheckboxes.innerHTML = ''; // Clear existing checkboxes
    games.forEach(game => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `game-${game}`;
        checkbox.value = game;
        checkbox.checked = true; // Default to checked
        checkbox.classList.add('form-check-input', 'mr-2');

        const label = document.createElement('label');
        label.htmlFor = `game-${game}`;
        label.textContent = game;
        label.classList.add('form-check-label');

        const div = document.createElement('div');
        div.classList.add('form-check');
        div.appendChild(checkbox);
        div.appendChild(label);

        gameCheckboxes.appendChild(div);
    });
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
        if (dataStore[game]) {
            allCards = allCards.concat(dataStore[game]);
        }
    });

    // Copy allCards to availableCards
    availableCards = [...allCards];

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
        const card = `
            <div class="d-flex align-items-center">
                <img src="logos/${imageName}.jpg" alt="${type}" class="mr-2" style="width: 30px; height: 30px;">
                <span class="card-title mr-auto">${type} Cards</span>
                <button class="btn btn-sm btn-outline-secondary decrease-btn" data-type="${type}" style="margin-right: 5px;">-</button>
                <input type="number" id="type-${type}" min="0" max="${maxCount}" value="0" class="form-control form-control-sm input-count" style="width: 60px;">
                <button class="btn btn-sm btn-outline-secondary increase-btn" data-type="${type}" style="margin-left: 5px;">+</button>
            </div>
        `;

        div.innerHTML = card;
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

// Function to toggle visibility of Sentry Rules options based on the checkbox
function toggleSentryRulesOptions() {
    const isEnabled = document.getElementById('enableSentryRules').checked;
    // Since "Introduce Sentry Cards" is now an action, no separate UI element needs to be toggled
    // However, you can disable/enable related UI elements if necessary
}

// Save configuration function
function saveConfiguration() {
    const config = {
        selectedGames,
        selectedDifficultyIndex: document.getElementById('difficultyLevel').value,
        cardCounts: {},
        sentryCardCounts: {},
        enableSentryRules: document.getElementById('enableSentryRules').checked
    };
    allCardTypes.forEach(type => {
        const inputId = `type-${type}`;
        const element = document.getElementById(inputId);
        const count = parseInt(element.value) || 0;
        if (sentryCardTypes.includes(type)) {
            config.sentryCardCounts[type] = count;
        } else {
            config.cardCounts[type] = count;
        }
    });
    // Save configuration including Sentry Rules state
    localStorage.setItem('savedConfig', JSON.stringify(config));
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
    } else {
        // If no configuration, set selectedGames to all games
        selectedGames = allGames.slice();
    }
}

// Function to restore card counts after card type inputs are generated
function restoreCardCounts() {
    const savedConfig = JSON.parse(localStorage.getItem('savedConfig'));
    if (savedConfig && (savedConfig.cardCounts || savedConfig.sentryCardCounts)) {
        allCardTypes.forEach(type => {
            const inputId = `type-${type}`;
            const element = document.getElementById(inputId);
            if (element) {
                if (sentryCardTypes.includes(type)) {
                    element.value = savedConfig.sentryCardCounts[type] || 0;
                } else {
                    element.value = savedConfig.cardCounts[type] || 0;
                }
            }
        });
    }
}

// Function to select cards by type considering '+' and '/'
function selectCardsByType(cardType, count, selectedCardsMap, cardCounts, isSentry = false) {
    let selectedCards = [];

    // Cards that can satisfy this type (considering '/' as OR)
    let cardsOfType = availableCards.filter(card => {
        let types = parseCardTypes(card.type);
        return types.includes(cardType);
    });

    // Shuffle cardsOfType
    let shuffledCards = shuffleDeck(cardsOfType);

    for (let card of shuffledCards) {
        if (selectedCards.length >= count) break;

        const cardId = card.id; // Use 'id' for uniqueness
        if (selectedCardsMap.has(cardId)) continue;

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

                // Decrease counts for all types
                for (let typePart of andTypes) {
                    let orTypes = typePart.split('/').map(s => s.trim());
                    for (let t of orTypes) {
                        if (cardCounts[t] > 0) {
                            cardCounts[t]--;
                            break; // Only decrease once per '+'
                        }
                    }
                }
            }
        } else {
            // For single type or '/' types
            if (cardCounts[cardType] > 0) {
                selectedCards.push(card);
                selectedCardsMap.set(cardId, true);
                cardCounts[cardType]--;
            }
        }
    }

    return selectedCards;
}

// Function to generate the deck
function generateDeck() {
    if (selectedGames.length === 0) {
        showToast('Please select at least one game.');
        return;
    }

    currentIndex = -1; // Start with -1 to display back.jpg first
    regularDeck = [];
    sentryDeck = [];

    // Reset availableCards without affecting user inputs
    resetAvailableCards();

    const selectedCardsMap = new Map(); // Use Map to store selected cards and their types

    // Copy of card counts to manage counts during selection
    const cardCounts = {};
    const sentryCardCounts = {};
    allCardTypes.forEach(type => {
        const inputId = `type-${type}`;
        const element = document.getElementById(inputId);
        const count = parseInt(element.value) || 0;
        if (sentryCardTypes.includes(type)) {
            sentryCardCounts[type] = count;
        } else {
            cardCounts[type] = count;
        }
    });

    // Check if Sentry Rules are enabled
    const isSentryEnabled = document.getElementById('enableSentryRules').checked;

    if (isSentryEnabled) {
        // Proceed with selecting regular and sentry cards separately

        // Selecting regular cards based on counts from inputs (excluding Sentry)
        let hasRegularCardSelection = false;
        allCardTypes.forEach(type => {
            if (sentryCardTypes.includes(type)) return; // Skip Sentry types here
            const count = cardCounts[type];
            if (count > 0) {
                hasRegularCardSelection = true;
                const selectedCards = selectCardsByType(type, count, selectedCardsMap, cardCounts, false);
                regularDeck = regularDeck.concat(selectedCards);
            }
        });

        // Selecting Sentry cards based on counts from inputs
        let hasSentryCardSelection = false;
        allCardTypes.forEach(type => {
            if (!sentryCardTypes.includes(type)) return; // Only handle Sentry types here
            const count = sentryCardCounts[type];
            if (count > 0) {
                hasSentryCardSelection = true;
                const selectedSentryCards = selectCardsByType(type, count, selectedCardsMap, sentryCardCounts, true);
                sentryDeck = sentryDeck.concat(selectedSentryCards);
            }
        });

        if (!hasRegularCardSelection && !hasSentryCardSelection) {
            showToast('Please select at least one card type with a count greater than zero.');
            return;
        }

        // Shuffle the regular deck
        regularDeck = shuffleDeck(regularDeck);

        // Set currentDeck to regularDeck
        currentDeck = regularDeck.slice(); // Start with regular deck

        // Sentry cards are kept in sentryDeck and introduced later
    } else {
        // Proceed with selecting all cards as regular cards

        // Selecting all cards based on counts from inputs
        let hasCardSelection = false;
        allCardTypes.forEach(type => {
            const count = cardCounts[type];
            if (count > 0) {
                hasCardSelection = true;
                const selectedCards = selectCardsByType(type, count, selectedCardsMap, cardCounts, false);
                regularDeck = regularDeck.concat(selectedCards);
            }
        });

        if (!hasCardSelection) {
            showToast('Please select at least one card type with a count greater than zero.');
            return;
        }

        // Shuffle the entire deck
        regularDeck = shuffleDeck(regularDeck);

        // Set currentDeck to regularDeck
        currentDeck = regularDeck.slice(); // Start with regular deck
    }

    // Save the current configuration
    saveConfiguration();

    // Log for debugging
    console.log('Selected Games:', selectedGames);
    console.log('Regular Card Counts:', cardCounts);
    console.log('Sentry Card Counts:', sentryCardCounts);
    console.log('Available Cards:', availableCards);
    console.log('Generated Regular Deck:', regularDeck);
    console.log('Generated Sentry Deck:', sentryDeck);
    console.log('Sentry Rules Enabled:', isSentryEnabled);

    displayDeck();

    // Show the Card Action section after deck generation
    document.getElementById('cardActionSection').style.display = 'block';

    // Collapse the "Select Games" and "Select Card Types" sections
    $('#gameCheckboxes').collapse('hide');
    $('#cardTypeSection').collapse('hide');
}

// Function to reset availableCards without affecting the DOM
function resetAvailableCards() {
    // Flatten cards from selected games
    let allCards = [];
    selectedGames.forEach(game => {
        if (dataStore[game]) {
            allCards = allCards.concat(dataStore[game]);
        }
    });

    // Copy allCards to availableCards
    availableCards = [...allCards];
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
                <div class="card-item">
                    <strong>Start the Game</strong><br>
                    <img src="cardimages/back.jpg" alt="Card Back" class="card-image img-fluid">
                </div>
            `;
        } else {
            const card = currentDeck[currentIndex];
            // Use .png extension for card images
            contentHTML = `
                <div class="card-item">
                    <strong>${card.card}</strong>${card.type ? ` (${card.type})` : ''}<br>
                    <img src="cardimages/${card.contents.replace(/\.\w+$/, '.png')}" alt="${card.card}" class="card-image img-fluid">
                </div>
            `;
        }

        output.innerHTML = contentHTML;

        // Update progress bar
        updateProgressBar();

        // Fade in
        output.style.opacity = 1;

        // Scroll the card display area into view
        output.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
}

// Function to display the deck
function displayDeck() {
    const output = document.getElementById('deckOutput');
    output.innerHTML = ''; // Clear previous deck

    const navButtons = document.getElementById('navigationButtons');

    const isSentryEnabled = document.getElementById('enableSentryRules').checked;

    if (currentDeck.length === 0 && (!isSentryEnabled || sentryDeck.length === 0)) {
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

    let totalRegularCards = regularDeck.length + 1; // Including the back card
    let totalSentryCards = isSentryEnabled ? sentryDeck.length : 0;
    let totalCards = totalRegularCards + totalSentryCards;

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

    if (currentIndex < currentDeck.length - 1) {
        currentIndex++;
        showCurrentCard();
    } else if (isSentryEnabled && sentryDeck.length > 0) {
        showToast('All regular cards have been revealed. Introduce Sentry cards to continue.');
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

// Toggle visibility of the top N input based on the card action selected
document.getElementById('cardAction').addEventListener('change', (event) => {
    const cardAction = event.target.value;
    const actionTopNInput = document.getElementById('actionTopNInput');

    if (cardAction === 'shuffleTopN') {
        actionTopNInput.style.display = 'block'; // Show input
    } else {
        actionTopNInput.style.display = 'none'; // Hide input
    }
});

// Apply card action to the active card
document.getElementById('applyCardAction').addEventListener('click', () => {
    const cardAction = document.getElementById('cardAction').value;

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
        // Existing logic for shuffleAnywhere
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
        // Existing logic for shuffleTopN
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
        // **New Introduce Sentry Cards Logic**
        introduceSentryCards();
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
        const cardTypes = parseCardTypes(card.type).map(type => type.trim().toLowerCase()).sort();
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

// Function to introduce Sentry cards into the remaining deck
function introduceSentryCards() {
    if (sentryDeck.length === 0) {
        showToast('No Sentry cards to introduce.');
        return;
    }

    // Define the starting point for shuffling (after the current card)
    const insertionStart = currentIndex + 1;

    // Extract the remaining deck
    const remainingDeck = currentDeck.slice(insertionStart);

    // Combine remaining deck with sentryDeck
    const combinedDeck = remainingDeck.concat(sentryDeck);

    // Shuffle the combined deck
    const shuffledCombinedDeck = shuffleDeck(combinedDeck);

    // Replace the remaining deck with the shuffled combined deck
    currentDeck = currentDeck.slice(0, insertionStart).concat(shuffledCombinedDeck);

    // Clear sentryDeck after introduction
    sentryDeck = [];

    // Disable the "Introduce Sentry Cards" option to prevent multiple introductions
    const cardActionSelect = document.getElementById('cardAction');
    const introduceOption = cardActionSelect.querySelector('option[value="introduceSentry"]');
    if (introduceOption) {
        introduceOption.disabled = true;
    }

    // Refresh the display
    showCurrentCard();

    showToast('Sentry cards have been introduced into the remaining deck.');
}

// Function to apply card action
// This is handled in the event listener above

// **Note:** Removed any references to the old Sentry Action Section as it's now part of card actions
