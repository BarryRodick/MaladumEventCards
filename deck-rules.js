import { parseCardTypes, shuffleDeck } from './card-utils.js';

export const DECK_RULE_ERRORS = {
    emptySelection: 'empty-selection'
};

export function buildDeck({
    allCardTypes = [],
    availableCards = [],
    dataStore = {},
    cardCounts = {},
    specialCardCounts = {},
    sentryCardCounts = {},
    enableSentryRules = false,
    enableCorrupterRules = false,
    corrupterReplacementCount = 5,
    deckDataByType = {},
    shuffle = shuffleDeck
} = {}) {
    const sentryTypes = dataStore.sentryTypes || [];
    const corrupterTypes = dataStore.corrupterTypes || [];
    const heldBackCardTypes = dataStore.heldBackCardTypes || [];
    const selectedCardsMap = new Map();
    const regularCounts = { ...cardCounts };
    const specialCounts = { ...specialCardCounts };
    const sentryCounts = { ...sentryCardCounts };
    const allAvailableCards = [...availableCards];

    const setAsideCards = [];
    const regularCardPool = allAvailableCards.filter(card => {
        if (isHeldBackCard(card, heldBackCardTypes)) {
            setAsideCards.push(card);
            return false;
        }
        return true;
    });

    let mainDeck = [];
    let specialDeck = [];
    let sentryDeck = [];
    let hasRegularCardSelection = false;
    let hasSpecialCardSelection = false;

    allCardTypes.forEach(type => {
        if (sentryTypes.includes(type) && enableSentryRules) return;
        if (corrupterTypes.includes(type) && enableCorrupterRules) return;

        const count = regularCounts[type];
        if (count > 0) {
            hasRegularCardSelection = true;
            const cardPool = heldBackCardTypes.includes(type) ? setAsideCards : regularCardPool;
            const selected = selectCardsByType(type, count, selectedCardsMap, regularCounts, cardPool, shuffle);
            mainDeck = mainDeck.concat(selected);
        }
    });

    if (enableCorrupterRules) {
        allCardTypes.forEach(type => {
            if (!corrupterTypes.includes(type)) return;
            const count = specialCounts[type];
            if (count > 0) {
                hasSpecialCardSelection = true;
                const selected = selectCardsByType(type, count, selectedCardsMap, specialCounts, allAvailableCards, shuffle);
                specialDeck = specialDeck.concat(selected);
            }
        });
    }

    if (enableSentryRules) {
        allCardTypes.forEach(type => {
            if (!sentryTypes.includes(type)) return;
            const count = sentryCounts[type];
            if (count > 0) {
                const selected = selectCardsByType(type, count, selectedCardsMap, sentryCounts, allAvailableCards, shuffle);
                sentryDeck = sentryDeck.concat(selected);
            }
        });
    }

    if (!hasRegularCardSelection && !hasSpecialCardSelection && sentryDeck.length === 0) {
        return { error: DECK_RULE_ERRORS.emptySelection };
    }

    if (enableCorrupterRules && mainDeck.length >= corrupterReplacementCount) {
        const replacementPool = specialDeck.length > 0
            ? specialDeck
            : getSpecialCards(corrupterReplacementCount, corrupterTypes, deckDataByType, shuffle);
        const corrupterCards = shuffle([...replacementPool]).slice(0, corrupterReplacementCount);

        if (corrupterCards.length > 0) {
            mainDeck.splice(0, corrupterCards.length);
            mainDeck = mainDeck.concat(corrupterCards);
        }

        specialDeck = [];
    }

    mainDeck = shuffle(mainDeck);
    const combinedDeck = mainDeck.concat(specialDeck);

    return {
        mainDeck,
        specialDeck,
        combinedDeck,
        sentryDeck,
        setAsideCards,
        selectedCardIds: collectSelectedCardIds(combinedDeck, sentryDeck)
    };
}

function isHeldBackCard(card, heldBackCardTypes) {
    const typeInfo = parseCardTypes(card.type);
    return typeInfo.allTypes.some(type => heldBackCardTypes.includes(type));
}

function selectCardsByType(cardType, count, selectedCardsMap, cardCounts, cardPool, shuffle) {
    const selectedCards = [];
    const cardsOfType = cardPool.filter(card => {
        const typeInfo = parseCardTypes(card.type);
        return typeInfo.allTypes.includes(cardType);
    });

    const shuffledCards = shuffle([...cardsOfType]);

    for (const card of shuffledCards) {
        if (selectedCards.length >= count) break;
        if (selectedCardsMap.has(card.id)) continue;

        const typeInfo = parseCardTypes(card.type);
        let canSelect = true;

        typeInfo.andGroups.forEach(orOptions => {
            const hasValidOption = orOptions.some(type => {
                if (type === cardType) return true;
                return cardCounts[type] && cardCounts[type] > 0;
            });
            if (!hasValidOption) canSelect = false;
        });

        if (canSelect) {
            selectedCards.push(card);
            selectedCardsMap.set(card.id, true);

            typeInfo.andGroups.forEach(orOptions => {
                for (const type of orOptions) {
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

function getSpecialCards(count, specialTypes, deckDataByType, shuffle) {
    let specialCards = [];
    specialTypes.forEach(type => {
        if (deckDataByType[type]) {
            specialCards = specialCards.concat(deckDataByType[type]);
        }
    });

    if (specialCards.length === 0) return [];
    return shuffle([...specialCards]).slice(0, count);
}

function collectSelectedCardIds(currentDeck, sentryDeck) {
    return [
        ...currentDeck,
        ...sentryDeck
    ]
        .filter(card => card && card.id !== undefined)
        .map(card => card.id);
}
