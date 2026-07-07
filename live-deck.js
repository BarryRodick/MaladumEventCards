import { parseCardTypes, shuffleDeck } from './card-utils.js';

export function ensureSelectedCardsMap(deckState) {
    if (!deckState.cards) {
        deckState.cards = { selected: new Map() };
    } else if (!(deckState.cards.selected instanceof Map)) {
        deckState.cards.selected = new Map();
    }

    return deckState.cards.selected;
}

export function rebuildSelectedCardsMap(deckState, cardLists = null) {
    const selected = ensureSelectedCardsMap(deckState);
    selected.clear();

    const lists = cardLists || [
        deckState.currentDeck,
        deckState.discardPile,
        deckState.sentryDeck,
        deckState.inPlayCards
    ];

    lists.flat().forEach(card => {
        if (card && card.id !== undefined) {
            selected.set(card.id, true);
        }
    });

    return selected;
}

export function advanceLiveDeck(deckState, { shuffle = shuffleDeck } = {}) {
    if (deckState.isActiveCardCleared) {
        deckState.isActiveCardCleared = false;
        return { render: true, direction: 'forward' };
    }

    if (deckState.currentIndex >= 0 && deckState.currentIndex < deckState.currentDeck.length) {
        deckState.discardPile.push(deckState.currentDeck[deckState.currentIndex]);
    }

    deckState.currentIndex++;

    if (deckState.currentIndex >= deckState.currentDeck.length) {
        if (deckState.discardPile.length > 0) {
            deckState.currentDeck = shuffle(deckState.discardPile);
            deckState.initialDeckSize = deckState.currentDeck.length;
            deckState.discardPile = [];
            deckState.currentIndex = -1;
            return {
                render: true,
                direction: 'forward',
                message: 'Deck reshuffled from discard pile.'
            };
        }

        deckState.currentIndex--;
        return {
            render: false,
            message: 'No more cards in the deck.'
        };
    }

    return { render: true, direction: 'forward' };
}

export function goToPreviousCard(deckState) {
    if (deckState.currentIndex <= -1) {
        return false;
    }

    deckState.isActiveCardCleared = false;

    if (deckState.currentIndex === 0) {
        deckState.currentIndex = -1;
        return true;
    }

    if (deckState.discardPile.length > 0) {
        deckState.discardPile.pop();
    }

    deckState.currentIndex--;
    return true;
}

export function clearActiveCard(deckState) {
    if (deckState.currentIndex < 0) return false;
    deckState.isActiveCardCleared = true;
    return true;
}

export function markCardInPlay(deckState, card) {
    if (deckState.inPlayCards.some(inPlayCard => inPlayCard.id === card.id)) {
        return false;
    }

    deckState.inPlayCards.push(card);
    return true;
}

export function removeCardFromPlay(deckState, cardId) {
    deckState.inPlayCards = deckState.inPlayCards.filter(card => card.id !== cardId);
}

export function clearInPlayCards(deckState) {
    deckState.inPlayCards = [];
}

export const liveDeckActions = {
    shuffleAnywhere: (deckState, card) => {
        deckState.currentDeck.splice(deckState.currentIndex, 1);
        const remaining = deckState.currentDeck.length - deckState.currentIndex;
        const randomOffset = Math.floor(Math.random() * (remaining + 1));
        deckState.currentDeck.splice(deckState.currentIndex + randomOffset, 0, card);

        if (deckState.currentIndex > 0) {
            deckState.currentIndex--;
        } else {
            deckState.currentIndex = -1;
        }

        return {
            message: `Card "${card.card}" shuffled back into the deck.`,
            render: true,
            direction: 'backward'
        };
    },

    shuffleTopN: (deckState, card, n) => {
        const remaining = deckState.currentDeck.length - (deckState.currentIndex + 1);
        if (remaining <= 0) {
            return { message: 'No remaining cards to shuffle into.' };
        }

        const requestedN = Math.max(1, parseInt(n, 10) || 1);
        const actualN = Math.min(requestedN, remaining);

        deckState.currentDeck.splice(deckState.currentIndex, 1);
        const insertIdx = deckState.currentIndex + Math.floor(Math.random() * actualN);
        deckState.currentDeck.splice(insertIdx, 0, card);

        return {
            message: `Card "${card.card}" shuffled into the next ${actualN} cards.`,
            render: true
        };
    },

    replaceSameType: (deckState, card) => {
        const typeInfo = parseCardTypes(card.type);
        const selected = ensureSelectedCardsMap(deckState);
        const replacements = deckState.availableCards.filter(candidate => {
            if (candidate.id === card.id || selected.has(candidate.id)) return false;
            const candidateTypeInfo = parseCardTypes(candidate.type);
            const isSentry = candidateTypeInfo.allTypes.some(type => deckState.dataStore.sentryTypes.includes(type));
            const isCorrupter = candidateTypeInfo.allTypes.some(type => deckState.dataStore.corrupterTypes.includes(type));
            if ((isSentry && deckState.enableSentryRules) || (isCorrupter && deckState.enableCorrupterRules)) return false;
            return candidateTypeInfo.allTypes.some(type => typeInfo.allTypes.includes(type));
        });

        if (replacements.length === 0) {
            return { message: 'No replacement cards of the same type available.' };
        }

        const replacement = replacements[Math.floor(Math.random() * replacements.length)];
        deckState.currentDeck[deckState.currentIndex] = replacement;
        selected.delete(card.id);
        selected.set(replacement.id, true);

        return {
            message: `Card "${card.card}" replaced with "${replacement.card}".`,
            render: true
        };
    },

    introduceSentry: (deckState) => {
        if (!deckState.sentryDeck || deckState.sentryDeck.length === 0) {
            return { message: 'No Sentry cards available to introduce.' };
        }

        const pastCards = deckState.currentDeck.slice(0, deckState.currentIndex + 1);
        const futureCards = deckState.currentDeck.slice(deckState.currentIndex + 1);
        const newFuture = shuffleDeck(futureCards.concat(deckState.sentryDeck));

        deckState.currentDeck = pastCards.concat(newFuture);

        const count = deckState.sentryDeck.length;
        deckState.sentryDeck = [];

        return {
            message: `${count} Sentry cards shuffled into the deck.`,
            progress: true
        };
    },

    insertCardType: (deckState, activeCard, params) => {
        const { cardType, specificCardId, position } = params;
        const selected = ensureSelectedCardsMap(deckState);
        const potentialCards = deckState.deckDataByType[cardType] || [];

        if (potentialCards.length === 0) {
            return { message: `No cards of type "${cardType}" available.` };
        }

        let cardToInsert;
        if (specificCardId) {
            cardToInsert = potentialCards.find(card => String(card.id) === String(specificCardId));
            if (!cardToInsert) {
                return { message: `Selected card not found for type "${cardType}".` };
            }
            if (selected.has(cardToInsert.id)) {
                return { message: `Card "${cardToInsert.card}" is already in the deck.` };
            }
        }

        if (!cardToInsert) {
            const availableCards = potentialCards.filter(card => !selected.has(card.id));
            if (availableCards.length === 0) {
                return { message: `No available cards of type "${cardType}" to insert.` };
            }
            cardToInsert = availableCards[Math.floor(Math.random() * availableCards.length)];
        }

        cardToInsert = { ...cardToInsert };
        insertCardIntoDeck(deckState, cardToInsert, position);

        return {
            message: `Inserted "${cardToInsert.card}" (${cardType}) into the deck (${position}).`,
            progress: true
        };
    }
};

export function shuffleCardIntoTopN(deckState, cardId, n) {
    if (!cardId) {
        return { ok: false, message: 'Select a card to shuffle into the deck.' };
    }

    if (!deckState.currentDeck || deckState.currentDeck.length === 0) {
        return { ok: false, message: 'No active deck available. Generate a deck first.' };
    }

    const targetCard = deckState.availableCards.find(card => String(card.id) === String(cardId));
    if (!targetCard) {
        return { ok: false, message: 'Selected card could not be found.' };
    }

    if (deckState.currentIndex >= 0) {
        const activeCard = deckState.currentDeck[deckState.currentIndex];
        if (activeCard && String(activeCard.id) === String(targetCard.id)) {
            return { ok: false, message: 'Cannot shuffle the currently active card.' };
        }
    }

    const requestedN = Math.max(1, parseInt(n, 10) || 1);
    const insertStart = Math.max(0, deckState.currentIndex + 1);
    const remaining = deckState.currentDeck.length - insertStart;

    if (remaining <= 0) {
        return { ok: false, message: 'No remaining cards to shuffle into.' };
    }

    let existingIndex = deckState.currentDeck.findIndex(card => String(card.id) === String(targetCard.id));
    let cardToInsert = targetCard;
    let nextCurrentIndex = deckState.currentIndex;

    if (existingIndex !== -1) {
        const [existingCard] = deckState.currentDeck.splice(existingIndex, 1);
        cardToInsert = existingCard || targetCard;
        if (existingIndex <= deckState.currentIndex) {
            nextCurrentIndex = Math.max(-1, deckState.currentIndex - 1);
        }
    } else if (Array.isArray(deckState.discardPile)) {
        const discardedIndex = deckState.discardPile.findIndex(card => String(card.id) === String(targetCard.id));
        if (discardedIndex !== -1) {
            const [discardedCard] = deckState.discardPile.splice(discardedIndex, 1);
            cardToInsert = discardedCard || targetCard;
        } else {
            cardToInsert = { ...targetCard };
        }
    } else {
        cardToInsert = { ...targetCard };
    }

    const actualN = Math.min(requestedN, remaining);
    const adjustedInsertStart = Math.max(0, nextCurrentIndex + 1);
    const insertIndex = adjustedInsertStart + Math.floor(Math.random() * actualN);
    const selected = ensureSelectedCardsMap(deckState);

    deckState.currentIndex = nextCurrentIndex;
    deckState.currentDeck.splice(insertIndex, 0, cardToInsert);
    selected.set(cardToInsert.id, true);

    return {
        ok: true,
        card: cardToInsert,
        actualN,
        message: `Card "${cardToInsert.card}" shuffled into the next ${actualN} cards.`
    };
}

export function insertSpecificCardById(deckState, cardId, position = 'next') {
    if (!cardId) {
        return { ok: false, message: 'Select a card to insert.' };
    }

    if (!deckState.currentDeck || deckState.currentDeck.length === 0) {
        return { ok: false, message: 'No active deck available. Generate a deck first.' };
    }

    const targetCard = findCardById(deckState, cardId);
    if (!targetCard) {
        return { ok: false, message: 'Selected card could not be found.' };
    }

    const selected = ensureSelectedCardsMap(deckState);
    if (selected.has(targetCard.id)) {
        return { ok: false, message: `Card "${targetCard.card}" is already in the deck.` };
    }

    const cardToInsert = { ...targetCard };
    insertCardIntoDeck(deckState, cardToInsert, position);

    return {
        ok: true,
        card: cardToInsert,
        message: `Inserted "${cardToInsert.card}" into the deck (${position}).`
    };
}

function insertCardIntoDeck(deckState, cardToInsert, position = 'random') {
    let insertIndex;

    if (position === 'next') {
        insertIndex = Math.max(0, deckState.currentIndex + 1);
    } else if (position === 'bottom') {
        insertIndex = deckState.currentDeck.length;
    } else {
        const remaining = deckState.currentDeck.length - (deckState.currentIndex + 1);
        insertIndex = deckState.currentIndex + 1 + Math.floor(Math.random() * (remaining + 1));
    }

    deckState.currentDeck.splice(insertIndex, 0, cardToInsert);
    ensureSelectedCardsMap(deckState).set(cardToInsert.id, true);
}

function findCardById(deckState, cardId) {
    if (deckState.cardMap instanceof Map && deckState.cardMap.has(Number(cardId))) {
        return deckState.cardMap.get(Number(cardId));
    }

    return deckState.availableCards.find(card => String(card.id) === String(cardId)) || null;
}
