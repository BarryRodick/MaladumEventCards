/**
 * card-actions.js - Handles specific card actions and in-play state
 */
import { state } from './state.js';
import { parseCardTypes, shuffleDeck } from './card-utils.js';
import { showToast, trackEvent } from './app-utils.js';
import { saveConfiguration } from './config-manager.js';
import { showCurrentCard, updateProgressBar } from './deck-manager.js';

/**
 * Marks a card as being in play
 */
export function markCardAsInPlay(card) {
    if (!state.inPlayCards.some(c => c.id === card.id)) {
        state.inPlayCards.push(card);
        updateInPlayCardsDisplay();
        showToast(`Card "${card.card}" marked as in play.`);
        saveConfiguration();
        trackEvent('Card Status', 'Mark In Play', card.card);
    } else {
        showToast(`Card "${card.card}" is already in play.`);
    }
}

/**
 * Updates the UI display for cards currently in play
 */
export function updateInPlayCardsDisplay() {
    const inPlayContainer = document.getElementById('inPlayCards');
    const inPlaySection = document.getElementById('inPlaySection');
    if (!inPlayContainer || !inPlaySection) return;

    inPlayContainer.innerHTML = '';
    if (state.inPlayCards.length === 0) {
        inPlayContainer.innerHTML = '<p>No cards in play.</p>';
        inPlaySection.style.display = 'none';
        return;
    }

    inPlaySection.style.display = 'block';
    state.inPlayCards.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('card', 'mb-2');

        const cardBody = document.createElement('div');
        cardBody.classList.add('card-body');

        cardBody.innerHTML = `
            <h5 class="card-title">${card.card}</h5>
            <img src="cardimages/${card.contents.replace(/\.\w+$/, '.png')}" alt="${card.card}" class="card-img-top mb-2">
            <button class="btn btn-danger btn-sm remove-from-play" data-id="${card.id}">Remove from Play</button>
        `;

        cardDiv.appendChild(cardBody);
        inPlayContainer.appendChild(cardDiv);
    });

    // Add event listeners to remove buttons
    inPlayContainer.querySelectorAll('.remove-from-play').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.getAttribute('data-id'));
            removeCardFromPlay(id);
        });
    });
}

function removeCardFromPlay(cardId) {
    state.inPlayCards = state.inPlayCards.filter(c => c.id !== cardId);
    updateInPlayCardsDisplay();
    saveConfiguration();
}

/**
 * Handles the application of selected card actions
 */
/**
 * Handles the application of selected card actions
 */
export const cardActions = {
    shuffleAnywhere: (card) => {
        state.currentDeck.splice(state.currentIndex, 1);
        const remaining = state.currentDeck.length - state.currentIndex;
        const randomOffset = Math.floor(Math.random() * (remaining + 1));
        state.currentDeck.splice(state.currentIndex + randomOffset, 0, card);

        if (state.currentIndex > 0) {
            state.currentIndex--;
        } else {
            state.currentIndex = -1;
        }
        showCurrentCard('backward');
        return `Card "${card.card}" shuffled back into the deck.`;
    },

    shuffleTopN: (card, n) => {
        const remaining = state.currentDeck.length - (state.currentIndex + 1);
        if (remaining <= 0) {
            return 'No remaining cards to shuffle into.';
        }
        const requestedN = Math.max(1, parseInt(n, 10) || 1);
        const actualN = Math.min(requestedN, remaining);

        state.currentDeck.splice(state.currentIndex, 1);
        const insertIdx = state.currentIndex + Math.floor(Math.random() * actualN);
        state.currentDeck.splice(insertIdx, 0, card);

        showCurrentCard();
        return `Card "${card.card}" shuffled into the next ${actualN} cards.`;
    },

    replaceSameType: (card) => {
        const typeInfo = parseCardTypes(card.type);
        const replacements = state.availableCards.filter(c => {
            if (c.id === card.id || state.cards.selected.has(c.id)) return false;
            const rTypeInfo = parseCardTypes(c.type);
            return rTypeInfo.allTypes.some(t => typeInfo.allTypes.includes(t));
        });

        if (replacements.length === 0) return `No replacement cards of the same type available.`;

        const replacement = replacements[Math.floor(Math.random() * replacements.length)];
        state.currentDeck[state.currentIndex] = replacement;
        state.cards.selected.delete(card.id);
        state.cards.selected.set(replacement.id, true);

        showCurrentCard();
        return `Card "${card.card}" replaced with "${replacement.card}".`;
    },

    introduceSentry: () => {
        if (!state.sentryDeck || state.sentryDeck.length === 0) {
            return "No Sentry cards available to introduce.";
        }

        // Remove current card from deck momentarily to shuffle sentries into the *remaining* deck
        // Actually, usually sentries are just shuffled into the draw pile.
        // Let's keep specific logic: Shuffle sentries into the portion of the deck AFTER the current card.

        const pastCards = state.currentDeck.slice(0, state.currentIndex + 1);
        const futureCards = state.currentDeck.slice(state.currentIndex + 1);

        const newFuture = shuffleDeck(futureCards.concat(state.sentryDeck));
        state.currentDeck = pastCards.concat(newFuture);

        const count = state.sentryDeck.length;
        state.sentryDeck = []; // Clear them

        updateProgressBar();
        return `${count} Sentry cards shuffled into the deck.`;
    },

    insertCardType: (activeCard, params) => {
        const { cardType, specificCardId, position } = params;

        // Find potential cards
        const potentialCards = state.deckDataByType[cardType] || [];
        if (potentialCards.length === 0) {
            return `No cards of type "${cardType}" available.`;
        }

        let cardToInsert;
        if (specificCardId) {
            // Need to convert ID to string/number match if necessary, assuming string from select value
            cardToInsert = potentialCards.find(c => String(c.id) === String(specificCardId));
            if (!cardToInsert) {
                return `Selected card not found for type "${cardType}".`;
            }
            if (state.cards.selected.has(cardToInsert.id)) {
                return `Card "${cardToInsert.card}" is already in the deck.`;
            }
        }

        if (!cardToInsert) {
            // Pick random
            const availableCards = potentialCards.filter(c => !state.cards.selected.has(c.id));
            if (availableCards.length === 0) {
                return `No available cards of type "${cardType}" to insert.`;
            }
            cardToInsert = availableCards[Math.floor(Math.random() * availableCards.length)];
        }

        // Clone the card
        cardToInsert = { ...cardToInsert };

        // Determine insertion index
        let insertIndex;
        if (position === 'next') {
            insertIndex = state.currentIndex + 1;
        } else if (position === 'bottom') {
            insertIndex = state.currentDeck.length;
        } else { // random
            const remaining = state.currentDeck.length - (state.currentIndex + 1);
            insertIndex = state.currentIndex + 1 + Math.floor(Math.random() * (remaining + 1));
        }

        // Insert
        state.currentDeck.splice(insertIndex, 0, cardToInsert);
        state.cards.selected.set(cardToInsert.id, true);

        updateProgressBar();
        return `Inserted "${cardToInsert.card}" (${cardType}) into the deck (${position}).`;
    }
};

/**
 * Trigger an action by name
 * @param {string} actionName 
 * @param {any} param - extra parameter like N for shuffle
 */
export function triggerCardAction(actionName, param = null) {
    if (state.currentIndex === -1) {
        showToast('No active card to perform action on.');
        return;
    }

    const activeCard = state.currentDeck[state.currentIndex];

    // Check if function exists
    if (!cardActions[actionName]) {
        console.error(`Action ${actionName} not found`);
        return;
    }

    // Call action
    // Note: ensure 'introduceSentry' handles its own parameter ignoring if needed
    const result = cardActions[actionName](activeCard, param);

    if (result) {
        showToast(result);
        updateInPlayCardsDisplay();
        saveConfiguration();
        trackEvent('Card Action', actionName, activeCard.card);
    }
}
