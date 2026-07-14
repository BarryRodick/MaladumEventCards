/**
 * card-actions.js - Handles specific card actions and in-play state
 */
import { state } from './state.js';
import { showToast, trackEvent } from './app-utils.js';
import { saveConfiguration } from './config-manager.js';
import { showCurrentCard, updateProgressBar } from './deck-manager.js';
import {
    insertSpecificCardById as insertSpecificCardIntoLiveDeck,
    liveDeckActions,
    markCardInPlay,
    removeCardFromPlay as removeLiveCardFromPlay,
    shuffleCardIntoTopN as shuffleLiveCardIntoTopN
} from './live-deck.js';

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Marks a card as being in play
 */
export function markCardAsInPlay(card) {
    if (markCardInPlay(state, card)) {
        updateInPlayCardsDisplay();
        showToast(`Card "${escapeHtml(card.card)}" marked as in play.`);
        saveConfiguration();
        trackEvent('Card Status', 'Mark In Play', card.card);
    } else {
        showToast(`Card "${escapeHtml(card.card)}" is already in play.`);
    }
}

/**
 * Updates the UI display for cards currently in play
 */
export function updateInPlayCardsDisplay() {
    const inPlayContainer = document.getElementById('inPlayCards');
    const inPlaySection = document.getElementById('inPlaySection');
    const clearInPlayButton = document.getElementById('clearInPlayCards');
    if (!inPlayContainer || !inPlaySection) return;

    inPlayContainer.innerHTML = '';
    const hasActiveDeck = Array.isArray(state.currentDeck) && state.currentDeck.length > 0;
    const hasInPlayCards = Array.isArray(state.inPlayCards) && state.inPlayCards.length > 0;

    if (clearInPlayButton) {
        clearInPlayButton.hidden = !hasInPlayCards;
        clearInPlayButton.disabled = !hasInPlayCards;
    }

    if (!hasActiveDeck && !hasInPlayCards) {
        inPlayContainer.innerHTML = '<p class="in-play-empty">No cards in play.</p>';
        inPlaySection.style.display = 'none';
        updateProgressBar();
        return;
    }

    inPlaySection.style.display = 'block';
    if (!hasInPlayCards) {
        inPlayContainer.innerHTML = '<p class="in-play-empty">No cards in play.</p>';
        updateProgressBar();
        return;
    }

    state.inPlayCards.forEach(card => {
        const cardName = escapeHtml(card.card);
        const cardType = escapeHtml(card.type || '');
        const cardImage = escapeHtml((card.contents || '').replace(/\.\w+$/, '.png'));

        const cardDiv = document.createElement('div');
        cardDiv.classList.add('card', 'mb-2', 'in-play-card');

        const cardBody = document.createElement('div');
        cardBody.classList.add('card-body');

        cardBody.innerHTML = `
            <div class="in-play-card-copy">
                <h5 class="card-title">${cardName}</h5>
                <p class="in-play-card-type">${cardType}</p>
            </div>
            <button type="button" class="in-play-card-preview" data-card-id="${card.id}" data-card-name="${cardName}" data-card-image="${cardImage}" data-card-type="${cardType}" aria-label="Open ${cardName} card preview">
                <img src="cardimages/${cardImage}" alt="${cardName}" class="card-img-top">
            </button>
            <button type="button" class="btn btn-danger remove-from-play" data-id="${card.id}">Remove from Play</button>
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

    updateProgressBar();
}

function removeCardFromPlay(cardId) {
    removeLiveCardFromPlay(state, cardId);
    updateInPlayCardsDisplay();
    saveConfiguration();
}

function applyLiveDeckAction(actionName, activeCard, params) {
    const result = liveDeckActions[actionName](state, activeCard, params);
    if (result.render) {
        showCurrentCard(result.direction);
    }
    if (result.progress) {
        updateProgressBar();
    }
    return result.message;
}

export function shuffleCardIntoTopN(cardId, n) {
    const result = shuffleLiveCardIntoTopN(state, cardId, n);
    showToast(result.message);

    if (!result.ok) return;

    updateProgressBar();
    saveConfiguration();
    trackEvent('Card Action', 'shuffleTopNCard', result.card.card);
    showCurrentCard();
}

export function insertSpecificCardById(cardId, position = 'next') {
    const result = insertSpecificCardIntoLiveDeck(state, cardId, position);
    showToast(result.message);

    if (!result.ok) return;

    updateProgressBar();
    saveConfiguration();
    trackEvent('Card Action', `insertSpecificCard:${position}`, result.card.card);
    showCurrentCard();
}

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

    if (typeof liveDeckActions[actionName] !== 'function') {
        console.error(`Action ${actionName} not found`);
        return;
    }

    const result = applyLiveDeckAction(actionName, activeCard, param);

    if (result) {
        showToast(result);
        updateInPlayCardsDisplay();
        saveConfiguration();
        trackEvent('Card Action', actionName, activeCard.card);
    }
}
