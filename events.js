/**
 * events.js - Handles all global event listeners
 */
import { generateDeck, advanceToNextCard, showCurrentCard } from './deck-manager.js';
import {
    triggerCardAction,
    markCardAsInPlay,
    updateInPlayCardsDisplay,
    shuffleCardIntoTopN,
    insertSpecificCardById
} from './card-actions.js';
import { state } from './state.js';
import { trackEvent, debounce } from './app-utils.js';
import { saveConfiguration } from './config-manager.js';
import { setupManualUpdateCheck } from './update-utils.js';
import { updateCardSearchResults, showCardPreview, setDeckMode, toggleUtilityDrawer } from './ui-manager.js';
import { buildPreviewActionRequest } from './deck-flow-utils.js';

const debouncedSaveConfiguration = debounce(saveConfiguration, 400);
const debouncedCardSearch = debounce((value) => updateCardSearchResults(value), 150);

export function setupEventListeners() {
    const buildModeButton = document.getElementById('buildModeButton');
    if (buildModeButton) {
        buildModeButton.addEventListener('click', () => {
            setDeckMode('build', { openUtilities: true });
        });
    }

    const playModeButton = document.getElementById('playModeButton');
    if (playModeButton) {
        playModeButton.addEventListener('click', () => {
            setDeckMode('play');
        });
    }

    const toggleUtilityDrawerButton = document.getElementById('toggleUtilityDrawer');
    if (toggleUtilityDrawerButton) {
        toggleUtilityDrawerButton.addEventListener('click', () => {
            toggleUtilityDrawer();
        });
    }

    const summaryToggleUtilities = document.getElementById('summaryToggleUtilities');
    if (summaryToggleUtilities) {
        summaryToggleUtilities.addEventListener('click', () => {
            toggleUtilityDrawer();
        });
    }

    const summaryEditDeck = document.getElementById('summaryEditDeck');
    if (summaryEditDeck) {
        summaryEditDeck.addEventListener('click', () => {
            setDeckMode('build', { openUtilities: true, focusUtilities: true });
        });
    }

    // Generate Deck
    const generateBtn = document.getElementById('generateDeck');
    if (generateBtn) generateBtn.addEventListener('click', () => {
        if (state.currentDeck.length > 0 && state.currentIndex >= 0) {
            if (!confirm('This will replace your current deck. Continue?')) return;
        }
        generateDeck();
    });

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
                    if (state.discardPile.length > 0) {
                        state.discardPile.pop();
                    }
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

    const cardSearchResults = document.getElementById('cardSearchResults');
    if (cardSearchResults) {
        cardSearchResults.addEventListener('click', (e) => {
            const target = e.target.closest('.card-search-item');
            if (target) {
                openCardPreviewFromResult(target);
            }
        });

        cardSearchResults.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const target = e.target.closest('.card-search-item');
            if (target) {
                e.preventDefault();
                openCardPreviewFromResult(target);
            }
        });
    }

    const cardPreviewShuffleButton = document.querySelector('[data-card-preview-shuffle]');
    if (cardPreviewShuffleButton) {
        cardPreviewShuffleButton.addEventListener('click', () => {
            runCardPreviewAction('shuffleTopN');
        });
    }

    const cardPreviewInsertNextButton = document.querySelector('[data-card-preview-insert-next]');
    if (cardPreviewInsertNextButton) {
        cardPreviewInsertNextButton.addEventListener('click', () => {
            runCardPreviewAction('insertNext');
        });
    }

    const cardPreviewAddBottomButton = document.querySelector('[data-card-preview-add-bottom]');
    if (cardPreviewAddBottomButton) {
        cardPreviewAddBottomButton.addEventListener('click', () => {
            runCardPreviewAction('addToBottom');
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
            const posInput = document.querySelector('input[name="insertPos"]:checked');
            const position = posInput ? posInput.value : 'random';

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

function openCardPreviewFromResult(resultItem) {
    const { cardId, cardName, cardImage, cardType } = resultItem.dataset;
    if (!cardImage) return;
    showCardPreview({ id: cardId, name: cardName, image: cardImage, type: cardType });
    trackEvent('Card Search', 'Preview Card', cardName || '');
}

function runCardPreviewAction(actionName) {
    const modal = document.getElementById('cardPreviewModal');
    if (!modal) return;

    const request = buildPreviewActionRequest(actionName, modal.dataset, {
        count: document.getElementById('cardPreviewShuffleCount')?.value
    });

    if (!request) return;

    if (request.kind === 'shuffleTopN') {
        shuffleCardIntoTopN(request.cardId, request.count);
        return;
    }

    if (request.kind === 'insertSpecificCard') {
        insertSpecificCardById(request.cardId, request.position);
    }
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
