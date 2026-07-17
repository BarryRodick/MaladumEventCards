import { state } from './state.js';
import { renderDeckSummary } from './ui-manager.js';

const preloadCache = [];

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getDeckCardDisplay(output) {
    let cardDisplay = output.querySelector('[data-deck-card-display]');
    if (!cardDisplay) {
        cardDisplay = document.createElement('div');
        cardDisplay.className = 'deck-card-display';
        cardDisplay.setAttribute?.('data-deck-card-display', '');
        output.appendChild(cardDisplay);
    }
    return cardDisplay;
}

function preloadUpcomingCards(count = 2) {
    preloadCache.length = 0;
    for (let i = 1; i <= count; i++) {
        const card = state.currentDeck[state.currentIndex + i];
        if (!card?.contents) continue;

        const image = new Image();
        image.src = `cardimages/${card.contents}`;
        preloadCache.push(image);
    }
}

export const liveDeckView = {
    renderCurrentCard() {
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

        const clearButton = document.getElementById('clearActiveCard');
        if (clearButton) {
            clearButton.style.display = state.currentIndex >= 0 && !state.isActiveCardCleared ? 'block' : 'none';
        }
        preloadUpcomingCards();
    },

    renderProgress() {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        if (!progressBar || !progressText) return;

        const totalCards = state.currentDeck.length;
        const currentCardNumber = state.currentIndex + 1;
        const percentage = state.currentIndex === -1 || totalCards === 0
            ? 0
            : (currentCardNumber / totalCards) * 100;

        progressText.textContent = state.currentIndex === -1
            ? 'Ready to draw'
            : `Card ${currentCardNumber} of ${totalCards}`;
        progressBar.style.width = `${percentage}%`;
        progressBar.setAttribute('aria-valuenow', percentage.toFixed(0));
        renderDeckSummary();
    },

    renderInPlayCards() {
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
            return;
        }

        inPlaySection.style.display = 'block';
        if (!hasInPlayCards) {
            inPlayContainer.innerHTML = '<p class="in-play-empty">No cards in play.</p>';
            return;
        }

        state.inPlayCards.forEach(card => {
            const cardName = escapeHtml(card.card);
            const cardType = escapeHtml(card.type || '');
            const cardImage = escapeHtml((card.contents || '').replace(/\.\w+$/, '.png'));
            const cardId = escapeHtml(card.id);
            const cardElement = document.createElement('div');
            const cardBody = document.createElement('div');

            cardElement.classList.add('card', 'mb-2', 'in-play-card');
            cardBody.classList.add('card-body');
            cardBody.innerHTML = `
                <div class="in-play-card-copy">
                    <h5 class="card-title">${cardName}</h5>
                    <p class="in-play-card-type">${cardType}</p>
                </div>
                <button type="button" class="in-play-card-preview" data-card-id="${cardId}" data-card-name="${cardName}" data-card-image="${cardImage}" data-card-type="${cardType}" aria-label="Open ${cardName} card preview">
                    <img src="cardimages/${cardImage}" alt="${cardName}" class="card-img-top">
                </button>
                <button type="button" class="btn btn-danger remove-from-play" data-id="${cardId}">Remove from Play</button>
            `;

            cardElement.appendChild(cardBody);
            inPlayContainer.appendChild(cardElement);
        });
    },

    renderAll() {
        this.renderCurrentCard();
        this.renderProgress();
        this.renderInPlayCards();
    }
};
