/**
 * events.js - Handles all global event listeners
 */
import { generateDeck, advanceToNextCard, showCurrentCard } from './deck-manager.js';
import { triggerCardAction, markCardAsInPlay, updateInPlayCardsDisplay } from './card-actions.js';
import { state } from './state.js';
import { trackEvent, debounce } from './app-utils.js';
import { saveConfiguration } from './config-manager.js';
import { setupManualUpdateCheck } from './update-utils.js';
import { updateCardSearchResults } from './ui-manager.js';

const debouncedSaveConfiguration = debounce(saveConfiguration, 400);
const debouncedCardSearch = debounce((value) => updateCardSearchResults(value), 150);

export function setupEventListeners() {
    // Generate Deck
    const generateBtn = document.getElementById('generateDeck');
    if (generateBtn) generateBtn.addEventListener('click', generateDeck);

    // Navigation
    const nextBtn = document.getElementById('nextCard');
    if (nextBtn) nextBtn.addEventListener('click', advanceToNextCard);

    const prevBtn = document.getElementById('prevCard');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (state.currentIndex > -1) {
                if (state.currentIndex === 0) {
                    state.currentIndex = -1;
                } else {
                    state.discardPile.pop();
                    state.currentIndex--;
                }
                showCurrentCard('backward');
                debouncedSaveConfiguration();
                trackEvent('Navigation', 'Previous Card', state.currentIndex);
            }
        });
    }

    // Interactions with the card image itself
    const deckOutput = document.getElementById('deckOutput');
    if (deckOutput) {
        deckOutput.addEventListener('click', (e) => {
            if (e.target.tagName === 'IMG' && !e.target.closest('#clearActiveCard')) {
                advanceToNextCard();
            }
        });
    }

    // Card Actions
    const actionButtons = document.querySelectorAll('.action-card-btn');
    actionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.getAttribute('data-action');
            const nConfig = document.getElementById('shuffleNConfig');
            const insertConfig = document.getElementById('insertCardConfig');

            // Hide all configs first
            if (nConfig) nConfig.style.display = 'none';
            if (insertConfig) insertConfig.style.display = 'none';

            if (action === 'shuffleTopN') {
                // Toggle UI for N configuration
                if (nConfig) {
                    nConfig.style.display = 'block';
                }
            } else if (action === 'insertCardType') {
                if (insertConfig) {
                    insertConfig.style.display = 'block';
                    populateInsertTypes();
                }
            } else {
                // Trigger action immediately
                triggerCardAction(action);
            }
        });
    });

    const confirmShuffleN = document.getElementById('confirmShuffleN');
    if (confirmShuffleN) {
        confirmShuffleN.addEventListener('click', () => {
            const nVal = parseInt(document.getElementById('actionN').value) || 3;
            triggerCardAction('shuffleTopN', nVal);
            document.getElementById('shuffleNConfig').style.display = 'none';
        });
    }

    const markInPlayBtn = document.getElementById('markInPlay');
    if (markInPlayBtn) {
        markInPlayBtn.addEventListener('click', () => {
            if (state.currentIndex >= 0 && state.currentDeck[state.currentIndex]) {
                markCardAsInPlay(state.currentDeck[state.currentIndex]);
            }
        });
    }

    const clearActiveCardBtn = document.getElementById('clearActiveCard');
    if (clearActiveCardBtn) {
        clearActiveCardBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.currentIndex = -1;
            showCurrentCard();
            trackEvent('Navigation', 'Clear Active Card', null);
        });
    }

    const clearInPlayBtn = document.getElementById('clearInPlayCards');
    if (clearInPlayBtn) {
        clearInPlayBtn.addEventListener('click', () => {
            state.inPlayCards = [];
            updateInPlayCardsDisplay();
            debouncedSaveConfiguration();
            trackEvent('Card Status', 'Clear In Play', null);
        });
    }

    const cardSearchInput = document.getElementById('cardSearchInput');
    if (cardSearchInput) {
        cardSearchInput.addEventListener('input', (e) => {
            debouncedCardSearch(e.target.value);
        });
    }

    // Insert Card Handlers
    const insertTypeSelect = document.getElementById('insertTypeSelect');
    if (insertTypeSelect) {
        insertTypeSelect.addEventListener('change', populateInsertSpecificCards);
    }

    const confirmInsertCard = document.getElementById('confirmInsertCard');
    if (confirmInsertCard) {
        confirmInsertCard.addEventListener('click', () => {
            const type = document.getElementById('insertTypeSelect').value;
            const specificId = document.getElementById('insertSpecificCardSelect').value;
            const position = document.querySelector('input[name="insertPos"]:checked').value;

            triggerCardAction('insertCardType', {
                cardType: type,
                specificCardId: specificId,
                position: position
            });

            document.getElementById('insertCardConfig').style.display = 'none';
        });
    }

    const cancelInsertCard = document.getElementById('cancelInsertCard');
    if (cancelInsertCard) {
        cancelInsertCard.addEventListener('click', () => {
            document.getElementById('insertCardConfig').style.display = 'none';
        });
    }

    setupManualUpdateCheck();
}

function populateInsertTypes() {
    const select = document.getElementById('insertTypeSelect');
    if (!select) return;

    select.innerHTML = '';
    state.allCardTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        select.appendChild(option);
    });

    // Trigger change to populate specific cards
    populateInsertSpecificCards();
}

function populateInsertSpecificCards() {
    const typeSelect = document.getElementById('insertTypeSelect');
    const specificSelect = document.getElementById('insertSpecificCardSelect');
    if (!typeSelect || !specificSelect) return;

    const type = typeSelect.value;
    const cards = state.deckDataByType[type] || [];

    specificSelect.innerHTML = '<option value="">Random</option>';

    // Sort cards by name
    const sortedCards = [...cards].sort((a, b) => a.card.localeCompare(b.card));

    sortedCards.forEach(card => {
        const option = document.createElement('option');
        option.value = card.id;
        option.textContent = card.card;
        specificSelect.appendChild(option);
    });
}
