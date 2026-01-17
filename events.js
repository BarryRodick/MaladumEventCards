/**
 * events.js - Handles all global event listeners
 */
import { generateDeck, advanceToNextCard, showCurrentCard } from './deck-manager.js';
import { applyCardAction, markCardAsInPlay } from './card-actions.js';
import { state } from './state.js';
import { trackEvent, debounce } from './app-utils.js';
import { saveConfiguration } from './config-manager.js';

const debouncedSaveConfiguration = debounce(saveConfiguration, 400);

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
    const applyActionBtn = document.getElementById('applyCardAction');
    if (applyActionBtn) applyActionBtn.addEventListener('click', applyCardAction);

    const markInPlayBtn = document.getElementById('markInPlay');
    if (markInPlayBtn) {
        markInPlayBtn.addEventListener('click', () => {
            if (state.currentIndex >= 0 && state.currentDeck[state.currentIndex]) {
                markCardAsInPlay(state.currentDeck[state.currentIndex]);
            }
        });
    }

    // Action specific UI toggles
    const cardActionSelect = document.getElementById('cardAction');
    if (cardActionSelect) {
        cardActionSelect.addEventListener('change', (e) => {
            const topNInput = document.getElementById('actionTopNInput');
            if (topNInput) {
                topNInput.style.display = e.target.value === 'shuffleTopN' ? 'block' : 'none';
            }
        });
    }
}
