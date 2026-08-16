import { parseCardTypes, shuffleDeck } from './card-utils.js';

export const DECK_RULE_ERRORS = {
    emptySelection: 'empty-selection',
    invalidCounts: 'invalid-counts'
};

/**
 * Parses a deck count without silently changing what the player entered.
 */
export function validateDeckCount(value, max) {
    const maximum = Number(max);
    const rawValue = typeof value === 'string' ? value.trim() : value;

    if (!Number.isInteger(maximum) || maximum < 0) {
        return { valid: false, message: 'This card type is unavailable.' };
    }

    if (rawValue === '' || rawValue === null || rawValue === undefined) {
        return { valid: false, message: `Enter a whole number from 0 to ${maximum}.` };
    }

    const count = typeof rawValue === 'number'
        ? rawValue
        : /^\d+$/.test(rawValue)
            ? Number(rawValue)
            : Number.NaN;

    if (!Number.isInteger(count) || count < 0 || count > maximum) {
        return { valid: false, message: `Enter a whole number from 0 to ${maximum}.` };
    }

    return { valid: true, value: count };
}

export function buildDeck({
    allCardTypes = [],
    availableCards = [],
    dataStore = {},
    cardCounts = {},
    sentryCardCounts = {},
    enableSentryRules = false,
    enableCorrupterRules = false,
    corrupterReplacementCount = 5,
    deckDataByType = {},
    shuffle = shuffleDeck
} = {}) {
    const invalidCounts = validateDeckCounts({
        allCardTypes,
        availableCards,
        cardCounts,
        sentryCardCounts
    });
    if (invalidCounts.length > 0) {
        return { error: DECK_RULE_ERRORS.invalidCounts, invalidCounts };
    }

    const sentryTypes = dataStore.sentryTypes || [];
    const corrupterTypes = dataStore.corrupterTypes || [];
    const heldBackCardTypes = dataStore.heldBackCardTypes || [];
    const selectedCardsMap = new Map();
    const regularCounts = normalizeDeckCounts(cardCounts);
    const sentryCounts = normalizeDeckCounts(sentryCardCounts);
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
    // Retain the state shape; Corrupters replace main-deck cards instead of forming a separate deck.
    const specialDeck = [];
    let sentryDeck = [];
    let hasRegularCardSelection = false;

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

    if (!hasRegularCardSelection && sentryDeck.length === 0) {
        return { error: DECK_RULE_ERRORS.emptySelection };
    }

    if (enableCorrupterRules && mainDeck.length >= corrupterReplacementCount) {
        const replacementPool = getSpecialCards(corrupterReplacementCount, corrupterTypes, deckDataByType, shuffle);
        const corrupterCards = shuffle([...replacementPool]).slice(0, corrupterReplacementCount);

        if (corrupterCards.length > 0) {
            mainDeck.splice(0, corrupterCards.length);
            mainDeck = mainDeck.concat(corrupterCards);
        }
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

function validateDeckCounts({
    allCardTypes,
    availableCards,
    cardCounts,
    sentryCardCounts
}) {
    const maxCounts = getMaximumCardCounts(allCardTypes, availableCards);
    const invalidCounts = [];

    [cardCounts, sentryCardCounts].forEach(counts => {
        Object.entries(counts || {}).forEach(([type, value]) => {
            const result = validateDeckCount(value, maxCounts[type] ?? 0);
            if (!result.valid) invalidCounts.push({ type, message: result.message });
        });
    });

    return invalidCounts;
}

function getMaximumCardCounts(allCardTypes, availableCards) {
    return (allCardTypes || []).reduce((maxCounts, type) => {
        const cardIds = new Set();
        (availableCards || []).forEach((card, index) => {
            if (!parseCardTypes(card.type).allTypes.includes(type)) return;
            cardIds.add(card.id ?? `card-${index}`);
        });
        maxCounts[type] = cardIds.size;
        return maxCounts;
    }, {});
}

function normalizeDeckCounts(counts) {
    return Object.fromEntries(
        Object.entries(counts || {}).map(([type, value]) => [type, Number(value)])
    );
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
