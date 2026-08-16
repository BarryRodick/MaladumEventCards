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

    if (Number.isInteger(count) && count > maximum) {
        return {
            valid: false,
            requested: count,
            available: maximum,
            message: `Requested ${count}; ${maximum} available. Enter a whole number from 0 to ${maximum}.`
        };
    }

    if (!Number.isInteger(count) || count < 0) {
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
    specialCardCounts = {},
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
        sentryCardCounts,
        specialCardCounts
    });
    if (invalidCounts.length > 0) {
        return { error: DECK_RULE_ERRORS.invalidCounts, invalidCounts };
    }

    const sentryTypes = dataStore.sentryTypes || [];
    const corrupterTypes = dataStore.corrupterTypes || [];
    const heldBackCardTypes = dataStore.heldBackCardTypes || [];
    const requestedRegularCounts = normalizeDeckCounts(cardCounts);
    const requestedSentryCounts = normalizeDeckCounts(sentryCardCounts);
    const regularCounts = { ...requestedRegularCounts };
    const sentryCounts = { ...requestedSentryCounts };
    const allAvailableCards = [...availableCards];

    const setAsideCards = allAvailableCards.filter(card =>
        isHeldBackCard(card, heldBackCardTypes)
    );

    let mainDeck = [];
    // Retain the state shape; Corrupters replace main-deck cards instead of forming a separate deck.
    const specialDeck = [];
    let sentryDeck = [];
    const regularTypes = allCardTypes.filter(type =>
        !(sentryTypes.includes(type) && enableSentryRules)
        && !(corrupterTypes.includes(type) && enableCorrupterRules)
    );
    const activeSentryTypes = enableSentryRules
        ? allCardTypes.filter(type => sentryTypes.includes(type))
        : [];
    const hasRegularCardSelection = regularTypes.some(type => regularCounts[type] > 0);
    const allocationCounts = { ...regularCounts };
    if (enableSentryRules) {
        Object.entries(sentryCounts).forEach(([type, count]) => {
            allocationCounts[type] = (allocationCounts[type] || 0) + count;
        });
    }
    const deckAllocation = allocateCardsForCounts({
        counts: allocationCounts,
        allowedTypes: [...new Set([...regularTypes, ...activeSentryTypes])],
        cardPool: allAvailableCards,
        canUseCard(card, contribution) {
            const fulfilsSentryCount = activeSentryTypes.some(type => contribution[type] > 0);
            if (fulfilsSentryCount) return true;
            if (!isHeldBackCard(card, heldBackCardTypes)) return true;
            return Object.keys(contribution).some(type =>
                contribution[type] > 0 && heldBackCardTypes.includes(type)
            );
        }
    });
    deckAllocation.selections.forEach(({ card, contribution }) => {
        if (activeSentryTypes.some(type => contribution[type] > 0)) sentryDeck.push(card);
        else mainDeck.push(card);
    });
    Object.keys(regularCounts).forEach(type => {
        regularCounts[type] = deckAllocation.remainingCounts[type] ?? regularCounts[type];
    });
    if (enableSentryRules) {
        Object.keys(sentryCounts).forEach(type => {
            sentryCounts[type] = deckAllocation.remainingCounts[type] ?? sentryCounts[type];
        });
    }

    const unfulfilledCounts = [
        ...getUnfulfilledCounts(requestedRegularCounts, regularCounts),
        ...getUnfulfilledCounts(requestedSentryCounts, sentryCounts)
    ];
    if (unfulfilledCounts.length > 0) {
        return { error: DECK_RULE_ERRORS.invalidCounts, invalidCounts: unfulfilledCounts };
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
    sentryCardCounts,
    specialCardCounts
}) {
    const maxCounts = getMaximumCardCounts(allCardTypes, availableCards);
    const invalidCounts = [];

    [cardCounts, sentryCardCounts, specialCardCounts].forEach(counts => {
        Object.entries(counts || {}).forEach(([type, value]) => {
            const result = validateDeckCount(value, maxCounts[type] ?? 0);
            if (!result.valid) {
                invalidCounts.push({
                    type,
                    ...(result.requested === undefined ? {} : { requested: result.requested }),
                    ...(result.available === undefined ? {} : { available: result.available }),
                    message: result.message
                });
            }
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

function getUnfulfilledCounts(requestedCounts, remainingCounts) {
    return Object.entries(remainingCounts)
        .filter(([, remaining]) => remaining > 0)
        .map(([type, remaining]) => {
            const requested = requestedCounts[type];
            const available = requested - remaining;
            return {
                type,
                requested,
                available,
                message: `Requested ${requested}; ${available} available with the selected card counts.`
            };
        });
}

function isHeldBackCard(card, heldBackCardTypes) {
    const typeInfo = parseCardTypes(card.type);
    return typeInfo.allTypes.some(type => heldBackCardTypes.includes(type));
}

function allocateCardsForCounts({
    counts,
    allowedTypes,
    cardPool,
    canUseCard = () => true
}) {
    const typeOrder = allowedTypes.filter(type => counts[type] > 0);
    const requestedTypes = new Set(typeOrder);
    const remainingCounts = { ...counts };
    const orderedCards = [...cardPool].sort(compareCardAllocationOrder);
    const candidateKeys = new Set();
    const candidates = orderedCards
        .map((card, index) => ({
            card,
            index,
            key: card.id ?? card,
            contributions: getCardContributions(card, requestedTypes)
        }))
        .filter(candidate => {
            if (candidateKeys.has(candidate.key)) return false;
            candidateKeys.add(candidate.key);
            return candidate.contributions.length > 0;
        });
    const usedCandidateIndexes = new Set();
    const deadEnds = new Set();
    const requestedTotal = getCountTotal(remainingCounts, typeOrder);
    let bestAllocation = {
        selections: [],
        remainingCounts: { ...remainingCounts },
        fulfilled: 0
    };

    function search(selectedSelections) {
        const remainingTotal = getCountTotal(remainingCounts, typeOrder);
        const fulfilled = requestedTotal - remainingTotal;
        if (fulfilled > bestAllocation.fulfilled) {
            bestAllocation = {
                selections: [...selectedSelections],
                remainingCounts: { ...remainingCounts },
                fulfilled
            };
        }
        if (remainingTotal === 0) return [...selectedSelections];

        const stateKey = `${typeOrder.map(type => remainingCounts[type]).join(',')}|${[
            ...usedCandidateIndexes
        ].sort((left, right) => left - right).join(',')}`;
        if (deadEnds.has(stateKey)) return null;
        if (!hasSufficientCapacity(remainingTotal)) {
            recordBestEffort(selectedSelections);
            deadEnds.add(stateKey);
            return null;
        }

        const target = findMostConstrainedType();
        if (!target || target.options.length === 0) {
            deadEnds.add(stateKey);
            return null;
        }

        for (const option of target.options) {
            const { candidate, contribution } = option;
            usedCandidateIndexes.add(candidate.index);
            applyContribution(remainingCounts, contribution, -1);
            selectedSelections.push({ card: candidate.card, contribution });

            const result = search(selectedSelections);
            if (result) return result;

            selectedSelections.pop();
            applyContribution(remainingCounts, contribution, 1);
            usedCandidateIndexes.delete(candidate.index);
        }

        deadEnds.add(stateKey);
        return null;
    }

    function findMostConstrainedType() {
        let target = null;

        typeOrder.forEach(type => {
            if (remainingCounts[type] <= 0) return;
            const options = getFeasibleOptions(type);
            if (!target || options.length < target.options.length) {
                target = { type, options };
            }
        });

        return target;
    }

    function getFeasibleOptions(targetType) {
        const options = [];

        candidates.forEach(candidate => {
            getFeasibleContributions(candidate).forEach(contribution => {
                if (!contribution[targetType]) return;
                options.push({ candidate, contribution });
            });
        });

        return options.sort((left, right) =>
            left.candidate.contributions.length - right.candidate.contributions.length
            || left.candidate.index - right.candidate.index
        );
    }

    function hasSufficientCapacity(remainingTotal) {
        const typeCapacity = Object.fromEntries(typeOrder.map(type => [type, 0]));
        let totalCapacity = 0;

        candidates.forEach(candidate => {
            const feasibleContributions = getFeasibleContributions(candidate);
            if (feasibleContributions.length === 0) return;

            totalCapacity += Math.max(...feasibleContributions.map(contribution =>
                Object.values(contribution).reduce((total, count) => total + count, 0)
            ));
            typeOrder.forEach(type => {
                typeCapacity[type] += Math.max(...feasibleContributions.map(contribution =>
                    contribution[type] || 0
                ));
            });
        });

        return totalCapacity >= remainingTotal
            && typeOrder.every(type => typeCapacity[type] >= remainingCounts[type]);
    }

    function getFeasibleContributions(candidate) {
        if (usedCandidateIndexes.has(candidate.index)) return [];
        return candidate.contributions.filter(contribution =>
            contributionFits(remainingCounts, contribution)
            && canUseCard(candidate.card, contribution)
        );
    }

    function recordBestEffort(selectedSelections) {
        const addedOptions = [];
        const bestEffortSelections = [...selectedSelections];

        while (getCountTotal(remainingCounts, typeOrder) > 0) {
            const target = findMostConstrainedType();
            if (!target || target.options.length === 0) break;
            const option = target.options[0];
            usedCandidateIndexes.add(option.candidate.index);
            applyContribution(remainingCounts, option.contribution, -1);
            bestEffortSelections.push({
                card: option.candidate.card,
                contribution: option.contribution
            });
            addedOptions.push(option);
        }

        const fulfilled = requestedTotal - getCountTotal(remainingCounts, typeOrder);
        if (fulfilled > bestAllocation.fulfilled) {
            bestAllocation = {
                selections: bestEffortSelections,
                remainingCounts: { ...remainingCounts },
                fulfilled
            };
        }

        addedOptions.reverse().forEach(option => {
            applyContribution(remainingCounts, option.contribution, 1);
            usedCandidateIndexes.delete(option.candidate.index);
        });
    }

    const exactSelections = search([]);
    const allocation = exactSelections
        ? { selections: exactSelections, remainingCounts: { ...remainingCounts } }
        : bestAllocation;

    return allocation;
}

function compareCardAllocationOrder(left, right) {
    const fields = ['id', 'card', 'type', 'contents'];
    for (const field of fields) {
        const comparison = String(left?.[field] ?? '').localeCompare(
            String(right?.[field] ?? ''),
            undefined,
            { numeric: true, sensitivity: 'base' }
        );
        if (comparison !== 0) return comparison;
    }
    return 0;
}

function getCardContributions(card, requestedTypes) {
    const typeInfo = parseCardTypes(card.type);
    let contributions = [{}];

    for (const andGroup of typeInfo.andGroups) {
        const groupOptions = [...new Set(andGroup.filter(type => requestedTypes.has(type)))];
        if (groupOptions.length === 0) return [];

        contributions = contributions.flatMap(contribution =>
            groupOptions.map(type => ({
                ...contribution,
                [type]: (contribution[type] || 0) + 1
            }))
        );
    }

    return [...new Map(contributions.map(contribution => [
        JSON.stringify(Object.entries(contribution).sort(([left], [right]) => left.localeCompare(right))),
        contribution
    ])).values()];
}

function getCountTotal(counts, types) {
    return types.reduce((total, type) => total + Math.max(0, counts[type] || 0), 0);
}

function contributionFits(remainingCounts, contribution) {
    return Object.entries(contribution).every(([type, count]) => remainingCounts[type] >= count);
}

function applyContribution(remainingCounts, contribution, direction) {
    Object.entries(contribution).forEach(([type, count]) => {
        remainingCounts[type] += count * direction;
    });
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
