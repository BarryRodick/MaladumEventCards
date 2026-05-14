/**
 * deck-manager.js - Handles deck generation, navigation, and display
 */
import { state, CONFIG, cardTypeId } from './state.js';
import { shuffleDeck, parseCardTypes } from './card-utils.js';
import { showToast, trackEvent, debounce } from './app-utils.js';
import { saveConfiguration } from './config-manager.js';
import { renderDeckSummary, setActionPanelOpen, setDeckMode } from './ui-manager.js';

const debouncedSaveConfiguration = debounce(saveConfiguration, 400);
const preloadCache = [];

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

    // 1. Set Aside Cards Based on heldBackCardTypes
    const allAvailableCards = [...state.availableCards];
    state.setAsideCards = [];
    const regularCardPool = allAvailableCards.filter(card => {
        if (isHeldBackCard(card)) {
            state.setAsideCards.push(card);
            return false;
        }
        return true;
    });

    // 2. Select Cards
    let hasRegularCardSelection = false;
    state.allCardTypes.forEach(type => {
        if (state.dataStore.sentryTypes.includes(type) && state.enableSentryRules) return;
        if (state.dataStore.corrupterTypes.includes(type) && state.enableCorrupterRules) return;

        const count = cardCounts[type];
        if (count > 0) {
            hasRegularCardSelection = true;
            const cardPool = isHeldBackType(type) ? state.setAsideCards : regularCardPool;
            const selected = selectCardsByType(type, count, state.cards.selected, cardCounts, cardPool);
            state.deck.main = state.deck.main.concat(selected);
        }
    });

    // Corrupter cards
    let hasSpecialCardSelection = false;
    if (state.enableCorrupterRules) {
        state.allCardTypes.forEach(type => {
            if (state.dataStore.corrupterTypes.includes(type)) {
                const count = specialCardCounts[type];
                if (count > 0) {
                    hasSpecialCardSelection = true;
                    const selected = selectCardsByType(type, count, state.cards.selected, specialCardCounts, allAvailableCards);
                    state.deck.special = state.deck.special.concat(selected);
                }
            }
        });
    }

    // Sentry cards
    if (state.enableSentryRules) {
        state.allCardTypes.forEach(type => {
            if (state.dataStore.sentryTypes.includes(type)) {
                const count = sentryCardCounts[type];
                if (count > 0) {
                    const selected = selectCardsByType(type, count, state.cards.selected, sentryCardCounts, allAvailableCards);
                    state.sentryDeck = state.sentryDeck.concat(selected);
                }
            }
        });
    }

    if (!hasRegularCardSelection && !hasSpecialCardSelection && state.sentryDeck.length === 0) {
        showToast('Please select at least one card type with a count greater than zero.');
        return;
    }

    // Apply Corrupter replacement Rules
    if (state.enableCorrupterRules && state.deck.main.length >= CONFIG.deck.corrupter.defaultCount) {
        const replacementCount = CONFIG.deck.corrupter.defaultCount;
        const replacementPool = state.deck.special.length > 0
            ? state.deck.special
            : getSpecialCards(replacementCount, state.dataStore.corrupterTypes);
        const corrupterCards = shuffleDeck([...replacementPool]).slice(0, replacementCount);

        if (corrupterCards.length > 0) {
            // Since we shuffle at the end, we can validly just remove from the front
            // instead of splicing from random indices repeatedly.
            state.deck.main.splice(0, corrupterCards.length);
            state.deck.main = state.deck.main.concat(corrupterCards);
        }

        state.deck.special = [];
    }

    // Final shuffle and combine
    state.deck.main = shuffleDeck(state.deck.main);
    state.currentDeck = state.deck.main.concat(state.deck.special);
    state.deck.combined = state.currentDeck;
    state.initialDeckSize = state.currentDeck.length;
    rebuildSelectedCardsMap();

    // UI Updates
    const activeDeckSection = document.getElementById('activeDeckSection');
    if (activeDeckSection) activeDeckSection.style.display = 'block';

    document.getElementById('navigationButtons').style.display = 'flex';
    document.getElementById('deckProgress').style.display = 'block';
    const cardActionSection = document.getElementById('cardActionSection');
    if (cardActionSection) cardActionSection.style.display = 'block';
    setActionPanelOpen(false);

    setDeckMode('play', { openUtilities: false, scrollToPlay: true });
    showCurrentCard();
    saveConfiguration();

    trackEvent('Deck', 'Generate', `Games: ${state.selectedGames.join(', ')}`, state.currentDeck.length);
}

/**
 * Core selection logic
 */
function isHeldBackType(type) {
    return state.dataStore.heldBackCardTypes.includes(type);
}

function isHeldBackCard(card) {
    const typeInfo = parseCardTypes(card.type);
    return typeInfo.allTypes.some(type => isHeldBackType(type));
}

function rebuildSelectedCardsMap() {
    state.cards.selected.clear();
    [
        ...state.currentDeck,
        ...state.sentryDeck
    ].forEach(card => {
        if (card && card.id !== undefined) {
            state.cards.selected.set(card.id, true);
        }
    });
}

function selectCardsByType(cardType, count, selectedCardsMap, cardCounts, cardPool = state.availableCards) {
    let selectedCards = [];
    let cardsOfType = cardPool.filter(card => {
        const typeInfo = parseCardTypes(card.type);
        return typeInfo.allTypes.includes(cardType);
    });

    let shuffledCards = shuffleDeck([...cardsOfType]);

    for (let card of shuffledCards) {
        if (selectedCards.length >= count) break;
        if (selectedCardsMap.has(card.id)) continue;

        const typeInfo = parseCardTypes(card.type);
        let canSelect = true;

        typeInfo.andGroups.forEach(orOptions => {
            let hasValidOption = orOptions.some(type => {
                if (type === cardType) return true;
                return cardCounts[type] && cardCounts[type] > 0;
            });
            if (!hasValidOption) canSelect = false;
        });

        if (canSelect) {
            selectedCards.push(card);
            selectedCardsMap.set(card.id, true);

            typeInfo.andGroups.forEach(orOptions => {
                for (let type of orOptions) {
                    if (cardCounts[type] && cardCounts[type] > 0) {
                        cardCounts[type]--;
                        break;
                    }
                }
            });
        }
    }
    return selectedCards;
}

function getSpecialCards(count, specialTypes) {
    let specialCards = [];
    specialTypes.forEach(type => {
        if (state.deckDataByType[type]) {
            specialCards = specialCards.concat(state.deckDataByType[type]);
        }
    });
    if (specialCards.length === 0) return [];
    return shuffleDeck([...specialCards]).slice(0, count);
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
            cardDisplay.innerHTML = `<img src="cardimages/${currentCard.contents}" alt="${currentCard.card}" class="img-fluid">`;
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
    if (state.isActiveCardCleared) {
        state.isActiveCardCleared = false;
        showCurrentCard('forward');
        return;
    }

    if (state.currentIndex >= 0 && state.currentIndex < state.currentDeck.length) {
        state.discardPile.push(state.currentDeck[state.currentIndex]);
    }

    state.currentIndex++;

    if (state.currentIndex >= state.currentDeck.length) {
        if (state.discardPile.length > 0) {
            state.currentDeck = shuffleDeck(state.discardPile);
            state.initialDeckSize = state.currentDeck.length;
            state.discardPile = [];
            state.currentIndex = -1;
            showToast('Deck reshuffled from discard pile.');
        } else {
            showToast('No more cards in the deck.');
            state.currentIndex--;
            return;
        }
    }

    showCurrentCard('forward');
}

export function clearActiveCardView() {
    if (state.currentIndex < 0) return;
    state.isActiveCardCleared = true;
    showCurrentCard();
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
