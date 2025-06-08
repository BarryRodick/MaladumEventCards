export const parseCardTypesCache = new Map();

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

export function shuffleDeck(deck) {
    let currentIndex = deck.length;
    let temporaryValue, randomIndex;

    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        temporaryValue = deck[currentIndex];
        deck[currentIndex] = deck[randomIndex];
        deck[randomIndex] = temporaryValue;
    }

    return deck;
}
