/**
 * events.js - Handles all global event listeners
 */
import { generateDeck, advanceToNextCard, showCurrentCard } from './deck-manager.js';
import { triggerCardAction, markCardAsInPlay } from './card-actions.js';
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
    const actionButtons = document.querySelectorAll('.action-card-btn');
    actionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.getAttribute('data-action');
            const nConfig = document.getElementById('shuffleNConfig');

            if (action === 'shuffleTopN') {
                // Toggle UI for N configuration
                if (nConfig) {
                    nConfig.style.display = nConfig.style.display === 'none' ? 'block' : 'none';
                }
            } else {
                // Hide N config if open
                if (nConfig) nConfig.style.display = 'none';

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

}
