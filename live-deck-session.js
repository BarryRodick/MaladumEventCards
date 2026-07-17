import { state } from './state.js';
import { shuffleDeck } from './card-utils.js';
import {
    advanceLiveDeck,
    goToPreviousCard,
    clearActiveCard,
    markCardInPlay,
    removeCardFromPlay,
    clearInPlayCards,
    liveDeckActions,
    shuffleCardIntoTopN,
    insertSpecificCardById
} from './live-deck.js';
import { liveDeckView } from './live-deck-view.js';
import { saveConfiguration } from './config-manager.js';
import { showToast, trackEvent } from './app-utils.js';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderCurrentAndSave(direction) {
    liveDeckView.renderCurrentCard(direction);
    liveDeckView.renderProgress();
    saveConfiguration();
}

export const liveDeckSession = {
    present() {
        liveDeckView.renderAll();
    },

    advance() {
        const result = advanceLiveDeck(state, { shuffle: shuffleDeck });

        if (result.message) {
            showToast(result.message);
        }

        if (result.render) {
            renderCurrentAndSave(result.direction);
        }
    },

    previous() {
        if (!goToPreviousCard(state)) return;

        renderCurrentAndSave('backward');
        trackEvent('Navigation', 'Previous Card', state.currentIndex);
    },

    clearActive() {
        if (!clearActiveCard(state)) return;

        renderCurrentAndSave();
        trackEvent('Navigation', 'Clear Active Card', null);
    },

    markActiveInPlay() {
        const activeCard = state.currentDeck[state.currentIndex];
        if (!activeCard) {
            showToast('No active card to mark as in play.');
            return;
        }

        if (!markCardInPlay(state, activeCard)) {
            showToast(`Card "${escapeHtml(activeCard.card)}" is already in play.`);
            return;
        }

        liveDeckView.renderInPlayCards();
        liveDeckView.renderProgress();
        showToast(`Card "${escapeHtml(activeCard.card)}" marked as in play.`);
        saveConfiguration();
        trackEvent('Card Status', 'Mark In Play', activeCard.card);
    },

    clearInPlay() {
        if (!Array.isArray(state.inPlayCards) || state.inPlayCards.length === 0) return;

        clearInPlayCards(state);
        liveDeckView.renderInPlayCards();
        liveDeckView.renderProgress();
        saveConfiguration();
        trackEvent('Card Status', 'Clear In Play', null);
    },

    removeFromPlay(cardId) {
        removeCardFromPlay(state, cardId);
        liveDeckView.renderInPlayCards();
        liveDeckView.renderProgress();
        saveConfiguration();
    },

    performAction(actionName, param = null) {
        const activeCard = state.currentDeck[state.currentIndex];
        if (!activeCard) {
            showToast('No active card to perform action on.');
            return;
        }

        const action = liveDeckActions[actionName];
        if (typeof action !== 'function') {
            console.error(`Action ${actionName} not found`);
            return;
        }

        const result = action(state, activeCard, param);
        const didChange = !!(result.render || result.progress);

        if (result.render) {
            liveDeckView.renderCurrentCard(result.direction);
        }
        if (didChange) {
            liveDeckView.renderProgress();
            liveDeckView.renderInPlayCards();
        }
        if (result.message) {
            showToast(result.message);
        }
        if (!didChange) return;

        saveConfiguration();
        trackEvent('Card Action', actionName, activeCard.card);
    },

    shuffleIntoTop(cardId, count) {
        const result = shuffleCardIntoTopN(state, cardId, count);
        if (result.message) {
            showToast(result.message);
        }
        if (!result.ok) return;

        renderCurrentAndSave();
        trackEvent('Card Action', 'shuffleTopNCard', result.card.card);
    },

    insertCard(cardId, position = 'next') {
        const result = insertSpecificCardById(state, cardId, position);
        if (result.message) {
            showToast(result.message);
        }
        if (!result.ok) return;

        renderCurrentAndSave();
        trackEvent('Card Action', `insertSpecificCard:${position}`, result.card.card);
    }
};
