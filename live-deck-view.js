import { state } from './state.js';
import { renderDeckSummary } from './ui-manager.js';
import { renderCardNode, renderCompactCardNode } from './card-renderer.mjs';

const preloadCache = [];

function clearChildren(node) {
    while (node.firstChild) {
        node.removeChild(node.firstChild);
    }
}

function getDeckCardDisplay(output) {
    let cardDisplay = output.querySelector('[data-deck-card-display]');
    if (!cardDisplay) {
        cardDisplay = document.createElement('div');
        cardDisplay.className = 'deck-card-display';
        cardDisplay.setAttribute('data-deck-card-display', '');
        output.appendChild(cardDisplay);
    }
    return cardDisplay;
}

function getRenderOptions() {
    return {
        document,
        iconRegistry: state.iconRegistry || {}
    };
}

function getCardImage(card, { pngFallback = false } = {}) {
    const image = String(card?.sourceImage || card?.contents || '');
    return pngFallback ? image.replace(/\.\w+$/, '.png') : image;
}

function configurePreviewButton(button, card, className, markerAttribute, { pngFallback = false } = {}) {
    const cardName = String(card?.card || 'Current card');
    button.type = 'button';
    button.className = className;
    if (markerAttribute) {
        button.setAttribute(markerAttribute, '');
    }
    button.dataset.cardId = String(card?.id ?? '');
    button.dataset.cardName = cardName;
    button.dataset.cardImage = getCardImage(card, { pngFallback });
    button.dataset.cardType = String(card?.type || '');
    button.setAttribute('aria-label', `Open ${cardName} card preview`);
}

function appendReadyState(container) {
    const readyState = document.createElement('div');
    readyState.className = 'deck-card-state';

    const image = document.createElement('img');
    image.src = 'cardimages/back.jpg';
    image.alt = 'Ready to draw';
    image.className = 'img-fluid';
    readyState.appendChild(image);

    const caption = document.createElement('p');
    caption.className = 'deck-card-caption';
    caption.textContent = 'Ready to draw';
    readyState.appendChild(caption);

    container.appendChild(readyState);
}

function appendEmptyInPlayState(container) {
    const emptyState = document.createElement('p');
    emptyState.className = 'in-play-empty';
    emptyState.textContent = 'No cards in play.';
    container.appendChild(emptyState);
}

function preloadUpcomingCards(count = 2) {
    preloadCache.length = 0;
    const currentDeck = Array.isArray(state.currentDeck) ? state.currentDeck : [];

    for (let i = 1; i <= count; i++) {
        const card = currentDeck[state.currentIndex + i];
        if (!card || card.renderMode === 'rich') continue;

        const sourceImage = getCardImage(card);
        if (!sourceImage) continue;

        const image = new Image();
        image.src = `cardimages/${sourceImage}`;
        preloadCache.push(image);
    }
}

export const liveDeckView = {
    renderCurrentCard() {
        const output = document.getElementById('deckOutput');
        if (!output) return;

        const currentDeck = Array.isArray(state.currentDeck) ? state.currentDeck : [];
        const currentCard = currentDeck[state.currentIndex];
        const cardDisplay = getDeckCardDisplay(output);
        const showCardBack = state.currentIndex === -1 || state.isActiveCardCleared || !currentCard;
        clearChildren(cardDisplay);

        if (showCardBack) {
            appendReadyState(cardDisplay);
        } else {
            const preview = document.createElement('button');
            configurePreviewButton(preview, currentCard, 'active-card-preview', 'data-active-card-preview');
            preview.appendChild(renderCardNode(currentCard, getRenderOptions()));
            cardDisplay.appendChild(preview);
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

        const currentDeck = Array.isArray(state.currentDeck) ? state.currentDeck : [];
        const totalCards = currentDeck.length;
        const currentCardNumber = state.currentIndex + 1;
        const percentage = state.currentIndex === -1 || totalCards === 0
            ? 0
            : (currentCardNumber / totalCards) * 100;

        const progressLabel = state.currentIndex === -1
            ? 'Ready to draw'
            : `Card ${currentCardNumber} of ${totalCards}`;
        progressText.textContent = progressLabel;
        progressBar.style.width = `${percentage}%`;
        progressBar.setAttribute('aria-valuenow', percentage.toFixed(0));
        progressBar.setAttribute('aria-valuetext', progressLabel);
        renderDeckSummary();
    },

    renderInPlayCards() {
        const inPlayContainer = document.getElementById('inPlayCards');
        const inPlaySection = document.getElementById('inPlaySection');
        const clearInPlayButton = document.getElementById('clearInPlayCards');
        if (!inPlayContainer || !inPlaySection) return;

        clearChildren(inPlayContainer);
        const currentDeck = Array.isArray(state.currentDeck) ? state.currentDeck : [];
        const inPlayCards = Array.isArray(state.inPlayCards) ? state.inPlayCards : [];
        const hasActiveDeck = currentDeck.length > 0;
        const hasInPlayCards = inPlayCards.length > 0;

        if (clearInPlayButton) {
            clearInPlayButton.hidden = !hasInPlayCards;
            clearInPlayButton.disabled = !hasInPlayCards;
        }

        if (!hasActiveDeck && !hasInPlayCards) {
            appendEmptyInPlayState(inPlayContainer);
            inPlaySection.style.display = 'none';
            return;
        }

        inPlaySection.style.display = 'block';
        if (!hasInPlayCards) {
            appendEmptyInPlayState(inPlayContainer);
            return;
        }

        inPlayCards.forEach(card => {
            const cardElement = document.createElement('div');
            const cardBody = document.createElement('div');
            const copy = document.createElement('div');
            const title = document.createElement('h5');
            const type = document.createElement('p');
            const preview = document.createElement('button');
            const removeButton = document.createElement('button');

            cardElement.classList.add('card', 'mb-2', 'in-play-card');
            cardBody.classList.add('card-body');
            copy.className = 'in-play-card-copy';
            title.className = 'card-title';
            title.textContent = String(card?.card || 'Card');
            type.className = 'in-play-card-type';
            type.textContent = String(card?.type || '');
            copy.appendChild(title);
            copy.appendChild(type);

            configurePreviewButton(preview, card, 'in-play-card-preview', null, { pngFallback: true });
            preview.appendChild(renderCompactCardNode(card, getRenderOptions()));

            removeButton.type = 'button';
            removeButton.className = 'btn btn-danger remove-from-play';
            removeButton.dataset.id = String(card?.id ?? '');
            removeButton.textContent = 'Remove from Play';

            cardBody.appendChild(copy);
            cardBody.appendChild(preview);
            cardBody.appendChild(removeButton);
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
