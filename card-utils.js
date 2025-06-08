// card-utils.js - ES module providing shared utilities
// Utility to parse card type strings like "A/B+C" into groups
const parseCardTypesCache = new Map();

export function parseCardTypes(typeString) {
    if (parseCardTypesCache.has(typeString)) {
        return parseCardTypesCache.get(typeString);
    }

    const andGroups = typeString.split('+').map(group => group.trim());
    const parsedGroups = andGroups.map(group => {
        const orOptions = group.split('/').map(option => option.trim());
        return orOptions;
    });

    const result = {
        andGroups: parsedGroups,
        allTypes: [...new Set(parsedGroups.flat())]
    };

    parseCardTypesCache.set(typeString, result);
    return result;
}

// Simple Fisher-Yates shuffle
export function shuffleDeck(deck) {
    let currentIndex = deck.length;
    while (currentIndex) {
        const randomIndex = Math.floor(Math.random() * currentIndex--);
        [deck[currentIndex], deck[randomIndex]] = [deck[randomIndex], deck[currentIndex]];
    }
    return deck;
}
