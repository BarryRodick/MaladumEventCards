/**
 * deck-manager.js - Handles deck generation, navigation, and display
 */
import { state, CONFIG, cardTypeId } from './state.js';
import { shuffleDeck } from './card-utils.js';
import { buildDeck, DECK_RULE_ERRORS } from './deck-rules.js';
import { advanceLiveDeck, clearActiveCard, rebuildSelectedCardsMap } from './live-deck.js';
import { showToast, trackEvent, debounce } from './app-utils.js';
import { saveConfiguration } from './config-manager.js';
import { renderDeckSummary, setActionPanelOpen, setDeckMode } from './ui-manager.js';
import { updateInPlayCardsDisplay } from './card-actions.js';

const debouncedSaveConfiguration = debounce(saveConfiguration, 400);
const preloadCache = [];

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Generates a new deck based on user configuration
 */
export function generateDeck() {
    if (state.selectedGames.length === 0) {
        showToast('Please select at least one game.');
        return;
    }

    state.currentIndex = -1;
    state.isActiveCardCleared = false;
    state.deck.main = [];
    state.deck.special = [];
    state.sentryDeck = [];
    state.discardPile = [];
    state.cards.selected.clear();

    const cardCounts = {};
    const specialCardCounts = {};
    const sentryCardCounts = {};

    state.allCardTypes.forEach(type => {
        const input = document.getElementById(cardTypeId(type));
        if (!input) return;
        const count = parseInt(input.value) || 0;

        if (state.dataStore.sentryTypes.includes(type) && state.enableSentryRules) {
            sentryCardCounts[type] = count;
        } else if (state.dataStore.corrupterTypes.includes(type) && state.enableCorrupterRules) {
            specialCardCounts[type] = count;
        } else {
            cardCounts[type] = count;
        }
    });

    const deckResult = buildDeck({
        allCardTypes: state.allCardTypes,
        availableCards: state.availableCards,
        dataStore: state.dataStore,
        cardCounts,
        specialCardCounts,
        sentryCardCounts,
        enableSentryRules: state.enableSentryRules,
        enableCorrupterRules: state.enableCorrupterRules,
        corrupterReplacementCount: CONFIG.deck.corrupter.defaultCount,
        deckDataByType: state.deckDataByType,
        shuffle: shuffleDeck
    });

    if (deckResult.error === DECK_RULE_ERRORS.emptySelection) {
        showToast('Please select at least one card type with a count greater than zero.');
        return;
    }

    state.deck.main = deckResult.mainDeck;
    state.deck.special = deckResult.specialDeck;
    state.currentDeck = deckResult.combinedDeck;
    state.deck.combined = state.currentDeck;
    state.sentryDeck = deckResult.sentryDeck;
    state.setAsideCards = deckResult.setAsideCards;
    state.initialDeckSize = state.currentDeck.length;
    rebuildSelectedCardsMap(state, [state.currentDeck, state.sentryDeck]);

    // UI Updates
    const activeDeckSection = document.getElementById('activeDeckSection');
    if (activeDeckSection) activeDeckSection.style.display = 'block';

    document.getElementById('navigationButtons').style.display = 'grid';
    document.getElementById('deckProgress').style.display = 'block';
    const cardActionSection = document.getElementById('cardActionSection');
    if (cardActionSection) cardActionSection.style.display = 'block';
    setActionPanelOpen(false);

    setDeckMode('play', { openUtilities: false, scrollToPlay: true });
    showCurrentCard();
    updateInPlayCardsDisplay();
    saveConfiguration();

    trackEvent('Deck', 'Generate', `Games: ${state.selectedGames.join(', ')}`, state.currentDeck.length);
}

/**
 * Display functions
 */
export function showCurrentCard(direction = null) {
    const output = document.getElementById('deckOutput');
    if (!output) return;
    const cardDisplay = getDeckCardDisplay(output);
    const showCardBack = state.currentIndex === -1 || state.isActiveCardCleared;

    if (showCardBack) {
        cardDisplay.innerHTML = `
            <div class="deck-card-state">
                <img src="cardimages/back.jpg" alt="Ready to draw" class="img-fluid">
                <p class="deck-card-caption">Ready to draw</p>
            </div>
        `;
    } else {
        const currentCard = state.currentDeck[state.currentIndex];
        if (currentCard) {
            const cardName = escapeHtml(currentCard.card || 'Current card');
            const cardType = escapeHtml(currentCard.type || '');
            const cardImage = escapeHtml(currentCard.contents || '');
            const cardId = escapeHtml(currentCard.id ?? '');
            cardDisplay.innerHTML = `
                <button type="button" class="active-card-preview" data-active-card-preview data-card-id="${cardId}" data-card-name="${cardName}" data-card-image="${cardImage}" data-card-type="${cardType}" aria-label="Open ${cardName} card preview">
                    <img src="cardimages/${cardImage}" alt="${cardName}" class="img-fluid">
                </button>
            `;
        }
    }

    const clearBtn = document.getElementById('clearActiveCard');
    if (clearBtn) clearBtn.style.display = state.currentIndex >= 0 && !state.isActiveCardCleared ? 'block' : 'none';

    updateProgressBar();
    preloadUpcomingCards();
    debouncedSaveConfiguration();
}

function getDeckCardDisplay(output) {
    let cardDisplay = output.querySelector('[data-deck-card-display]');
    if (!cardDisplay) {
        cardDisplay = document.createElement('div');
        cardDisplay.className = 'deck-card-display';
        if (cardDisplay.setAttribute) {
            cardDisplay.setAttribute('data-deck-card-display', '');
        }
        output.appendChild(cardDisplay);
    }
    return cardDisplay;
}

export function updateProgressBar() {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    if (!progressBar || !progressText) return;

    const totalCards = state.currentDeck.length;
    let percentage = 0;

    if (state.currentIndex === -1) {
        progressText.textContent = 'Ready to draw';
        percentage = 0;
    } else {
        const currentCardNumber = state.currentIndex + 1;
        progressText.textContent = `Card ${currentCardNumber} of ${totalCards}`;
        percentage = totalCards > 0 ? (currentCardNumber / totalCards) * 100 : 0;
    }

    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', percentage.toFixed(0));
    renderDeckSummary();
}

export function advanceToNextCard() {
    const result = advanceLiveDeck(state, { shuffle: shuffleDeck });
    if (result.message) {
        showToast(result.message);
    }

    if (result.render) {
        showCurrentCard(result.direction);
    }
}

export function clearActiveCardView() {
    if (clearActiveCard(state)) {
        showCurrentCard();
    }
}

function preloadUpcomingCards(count = 2) {
    preloadCache.length = 0;
    for (let i = 1; i <= count; i++) {
        const index = state.currentIndex + i;
        if (index >= 0 && index < state.currentDeck.length) {
            const card = state.currentDeck[index];
            if (card && card.contents) {
                const img = new Image();
                img.src = `cardimages/${card.contents}`;
                preloadCache.push(img);
            }
        }
    }
}
