/**
 * deck-manager.js - Handles deck generation, navigation, and display
 */
import { state, CONFIG } from './state.js';
import { shuffleDeck, parseCardTypes } from './card-utils.js';
import { showToast, trackEvent, debounce } from './app-utils.js';
import { saveConfiguration } from './config-manager.js';
import { toggleDeckBuilderUI } from './ui-manager.js';

const debouncedSaveConfiguration = debounce(saveConfiguration, 400);

/**
 * Generates a new deck based on user configuration
 */
export function generateDeck() {
    if (state.selectedGames.length === 0) {
        showToast('Please select at least one game.');
        return;
    }

    state.currentIndex = -1;
    state.deck.main = [];
    state.deck.special = [];
    state.sentryDeck = [];
    state.discardPile = [];
    state.cards.selected.clear();

    const cardCounts = {};
    const specialCardCounts = {};
    const sentryCardCounts = {};

    state.allCardTypes.forEach(type => {
        const input = document.getElementById(`type-${type}`);
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
    state.setAsideCards = [];
    state.availableCards = state.availableCards.filter(card => {
        const typeInfo = parseCardTypes(card.type);
        const isHeldBack = typeInfo.allTypes.some(t => state.dataStore.heldBackCardTypes.includes(t));
        if (isHeldBack) {
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
            const selected = selectCardsByType(type, count, state.cards.selected, cardCounts);
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
                    const selected = selectCardsByType(type, count, state.cards.selected, specialCardCounts);
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
                    const selected = selectCardsByType(type, count, state.cards.selected, sentryCardCounts);
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
    if (state.enableCorrupterRules && state.deck.main.length >= 5) {
        // Since we shuffle at the end, we can validly just remove the first 5 cards
        // instead of splicing from random indices 5 times.
        state.deck.main.splice(0, 5);

        // Replace with 5 special
        const corrupterCards = getSpecialCards(5, state.dataStore.corrupterTypes);
        state.deck.main = state.deck.main.concat(corrupterCards);
    }

    // Final shuffle and combine
    state.deck.main = shuffleDeck(state.deck.main);
    state.currentDeck = state.deck.main.concat(state.deck.special);
    state.deck.combined = state.currentDeck;
    state.initialDeckSize = state.currentDeck.length;

    // UI Updates
    const activeDeckSection = document.getElementById('activeDeckSection');
    if (activeDeckSection) activeDeckSection.style.display = 'block';

    document.getElementById('navigationButtons').style.display = 'block';
    document.getElementById('deckProgress').style.display = 'block';

    showCurrentCard();
    toggleDeckBuilderUI(true);
    saveConfiguration();

    trackEvent('Deck', 'Generate', `Games: ${state.selectedGames.join(', ')}`, state.currentDeck.length);
}

/**
 * Core selection logic
 */
function selectCardsByType(cardType, count, selectedCardsMap, cardCounts) {
    let selectedCards = [];
    let cardsOfType = state.availableCards.filter(card => {
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

    if (state.currentIndex === -1) {
        output.innerHTML = `<img src="cardimages/back.jpg" alt="Card Back" class="img-fluid">`;
    } else {
        const currentCard = state.currentDeck[state.currentIndex];
        if (currentCard) {
            output.innerHTML = `<img src="cardimages/${currentCard.contents}" alt="${currentCard.card}" class="img-fluid">`;
        }
    }

    const clearBtn = document.getElementById('clearActiveCard');
    if (clearBtn) clearBtn.style.display = state.currentIndex >= 0 ? 'block' : 'none';

    updateProgressBar();
    preloadUpcomingCards();
    debouncedSaveConfiguration();
}

export function updateProgressBar() {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    if (!progressBar || !progressText) return;

    const totalCards = state.currentDeck.length;
    let percentage = 0;

    if (state.currentIndex === -1) {
        progressText.textContent = `Card Back`;
        percentage = 0;
    } else {
        const currentCardNumber = state.currentIndex + 1;
        progressText.textContent = `Card ${currentCardNumber} of ${totalCards}`;
        percentage = totalCards > 0 ? (currentCardNumber / totalCards) * 100 : 0;
    }

    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', percentage.toFixed(0));
}

export function advanceToNextCard() {
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

function preloadUpcomingCards(count = 2) {
    for (let i = 1; i <= count; i++) {
        const index = state.currentIndex + i;
        if (index >= 0 && index < state.currentDeck.length) {
            const card = state.currentDeck[index];
            if (card && card.contents) {
                const img = new Image();
                img.src = `cardimages/${card.contents}`;
            }
        }
    }
}
