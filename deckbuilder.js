// Updated JavaScript Code (deckbuilder.js) with Fixes for Mobile Enhancements and PWA Registration

// Register the Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
                console.log('Service Worker registered with scope:', registration.scope);
            }, (err) => {
                console.log('Service Worker registration failed:', err);
            });
    });
}

let deckDataByType = {}; // Cards grouped by type
let currentDeck = [];    // Generated deck
let currentIndex = -1;   // Current card index (-1 to start with back.jpg)
let allGames = [];       // List of all games
let allCardTypes = [];   // List of all card types
let selectedGames = [];  // Selected games
let dataStore = {};      // Store data for access in functions
let availableCards = []; // Global array of available cards

// Enable dark mode by default
document.body.classList.add('dark-mode');

// Fetch the JSON file and load the data
fetch('maladumcards.json')
    .then(response => response.json())
    .then(data => {
        dataStore = data; // Store data for later use
        // Get all games (categories)
        allGames = Object.keys(data);

        // Generate game selection checkboxes
        generateGameSelection(allGames);

        // Event listener for game selection changes
        document.getElementById('gameCheckboxes').addEventListener('change', (event) => {
            if (event.target && event.target.matches('input[type="checkbox"]')) {
                loadCardTypes();
                saveConfiguration(); // Automatically save configuration when games are selected/deselected
            }
        });

        // Initial load of card types
        loadCardTypes();

        // Load configuration if available
        loadConfiguration();

        // Enhance buttons after DOM content is loaded
        enhanceButtons();
    })
    .catch(error => console.error('Error loading the JSON:', error));

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

    const searchTermElement = document.getElementById('cardTypeSearch');
    const searchTerm = searchTermElement ? searchTermElement.value.toLowerCase() : '';

    allCardTypes.sort(); // Sort the card types alphabetically

    allCardTypes.forEach(type => {
        if (type.toLowerCase().includes(searchTerm)) {
            // Adjust maxCount based on unique cards
            const uniqueCards = new Set(deckDataByType[type].map(card => card.card + card.contents));
            const maxCount = uniqueCards.size; // Set max count to number of unique cards of this type

            const div = document.createElement('div');
            div.classList.add('card-type-input', 'col-12', 'col-md-6', 'mb-3');

            const imageName = type.replace(/\s/g, '');
            const card = `
                <div class="d-flex align-items-center">
                    <img src="logos/${imageName}.jpg" alt="${type}" class="mr-2" style="width: 30px; height: 30px;">
                    <span class="card-title mr-auto">${type} Cards</span>
                    <button class="btn btn-sm btn-outline-secondary decrease-btn" data-type="${type}" style="margin-right: 5px;">-</button>
                    <input type="number" id="type-${type}" min="0" max="${maxCount}" value="${maxCount}" class="form-control form-control-sm input-count" style="width: 60px;">
                    <button class="btn btn-sm btn-outline-secondary increase-btn" data-type="${type}" style="margin-left: 5px;">+</button>
                </div>
            `;

            div.innerHTML = card;
            cardTypeInputs.appendChild(div);
        }
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

// Save configuration function
function saveConfiguration() {
    const config = {
        selectedGames,
        cardCounts: {}
    };
    allCardTypes.forEach(type => {
        const inputId = `type-${type}`;
        const element = document.getElementById(inputId);
        const count = parseInt(element.value) || 0;
        config.cardCounts[type] = count;
    });
    localStorage.setItem('savedConfig', JSON.stringify(config));
}

// Load configuration function
function loadConfiguration() {
    const savedConfig = JSON.parse(localStorage.getItem('savedConfig'));
    if (savedConfig) {
        // Restore game selections
        allGames.forEach(game => {
            const checkbox = document.getElementById(`game-${game}`);
            checkbox.checked = savedConfig.selectedGames.includes(game);
        });
        loadCardTypes(); // Reload card types based on selected games

        // Restore card counts
        allCardTypes.forEach(type => {
            const inputId = `type-${type}`;
            const element = document.getElementById(inputId);
            if (element) {
                element.value = savedConfig.cardCounts[type] || element.max;
            }
        });
    }
}

// Function to select cards by type considering '+' and '/'
function selectCardsByType(cardType, count, selectedCardsMap, cardCounts) {
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

        const cardId = card.card + card.contents;
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
        alert('Please select at least one game.');
        return;
    }

    currentIndex = -1; // Start with -1 to display back.jpg first
    currentDeck = [];

    let hasCardSelection = false;

    // Reset availableCards without affecting user inputs
    resetAvailableCards();

    const selectedCardsMap = new Map(); // Use Map to store selected cards and their types

    // Copy of card counts to manage counts during selection
    const cardCounts = {};
    allCardTypes.forEach(type => {
        const inputId = `type-${type}`;
        const element = document.getElementById(inputId);
        cardCounts[type] = parseInt(element.value) || 0;
        if (cardCounts[type] > 0) hasCardSelection = true;
    });

    if (!hasCardSelection) {
        alert('Please select at least one card type and specify the number of cards.');
        return;
    }

    allCardTypes.forEach(type => {
        const count = cardCounts[type];
        if (count > 0) {
            const selectedCards = selectCardsByType(type, count, selectedCardsMap, cardCounts);
            currentDeck = currentDeck.concat(selectedCards);
        }
    });

    // Shuffle the entire deck
    currentDeck = shuffleDeck(currentDeck);

    // Save the current configuration
    saveConfiguration();

    displayDeck();

    // Show the Card Action section after deck generation
    document.getElementById('cardActionSection').style.display = 'block';

    // Collapse the "Select Games" and "Select Card Types" sections
    $('#gameCheckboxes').collapse('hide');
    $('#cardTypeInputs').collapse('hide');
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

    if (currentDeck.length === 0) {
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

    let totalCards = currentDeck.length + 1; // Including the back card
    let currentCardNumber = currentIndex + 2; // +2 because currentIndex starts at -1

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
    if (currentIndex < currentDeck.length - 1) {
        currentIndex++;
        showCurrentCard();
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
        alert('No active card to apply action.');
        return;
    }

    const activeCard = currentDeck[currentIndex];

    if (cardAction === 'shuffleAnywhere') {
        // Remove the active card from the deck
        currentDeck.splice(currentIndex, 1);

        // Generate a random insertion index after the current index
        const insertionIndex = Math.floor(Math.random() * (currentDeck.length - currentIndex)) + currentIndex + 1;

        // Insert the card back into the deck
        currentDeck.splice(insertionIndex, 0, activeCard);

        alert('Card shuffled back into the deck.');

    } else if (cardAction === 'shuffleTopN') {
        let topN = parseInt(document.getElementById('actionN').value);
        if (isNaN(topN) || topN <= 0) {
            alert('Please enter a valid number for N.');
            return;
        }

        // Calculate the number of remaining cards after the current card
        const remainingCards = currentDeck.length - (currentIndex + 1);

        // Adjust topN if it exceeds the number of remaining cards
        if (topN > remainingCards) {
            topN = remainingCards;
            alert(`Only ${remainingCards} cards remaining. Shuffling into the next ${remainingCards} cards.`);
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

            alert(`Card shuffled into the next ${topN} cards.`);
        } else {
            alert('No remaining cards to shuffle into.');
        }

    } else {
        alert('Please select a valid action.');
        return;
    }

    // Move to the previous card
    if (currentIndex > 0) {
        currentIndex--;
        showCurrentCard();
    } else if (currentIndex === 0) {
        currentIndex = -1; // Go back to the start (back.jpg)
        showCurrentCard();
    } else {
        alert('You are at the beginning of the deck.');
    }
});

// Function to enhance buttons with ripple effect and touch feedback
function enhanceButtons() {
    document.querySelectorAll('button').forEach(button => {
        // Handle the ripple effect on button press
        const handleButtonClick = function (e) {
            // Touch feedback (vibration)
            if ('vibrate' in navigator) {
                navigator.vibrate(30);
            }

            // Get coordinates
            let x, y;
            if (e.type.startsWith('touch') && e.touches && e.touches.length > 0) {
                x = e.touches[0].clientX;
                y = e.touches[0].clientY;
            } else if (e.type.startsWith('pointer') && e.pointerType === 'touch') {
                x = e.clientX;
                y = e.clientY;
            } else {
                x = e.clientX;
                y = e.clientY;
            }

            // Create ripple
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${x - rect.left - size / 2}px`;
            ripple.style.top = `${y - rect.top - size / 2}px`;
            button.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        };

        button.addEventListener('click', handleButtonClick);

        // Use pointer events for better compatibility
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

