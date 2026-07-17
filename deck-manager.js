/**
 * deck-manager.js - Handles deck generation, navigation, and display
 */
import { state, CONFIG, cardTypeId } from './state.js';
import { shuffleDeck } from './card-utils.js';
import { buildDeck, DECK_RULE_ERRORS } from './deck-rules.js';
import { rebuildSelectedCardsMap } from './live-deck.js';
import { showToast, trackEvent } from './app-utils.js';
import { saveConfiguration } from './config-manager.js';
import { setActionPanelOpen, setDeckMode } from './ui-manager.js';
import { liveDeckView } from './live-deck-view.js';

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
    liveDeckView.renderAll();
    saveConfiguration();

    trackEvent('Deck', 'Generate', `Games: ${state.selectedGames.join(', ')}`, state.currentDeck.length);
}
