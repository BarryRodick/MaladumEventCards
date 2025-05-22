// Configuration constants

const CONFIG = {
    deck: {
        sentry: {
            defaultCount: 4,
            minCount: 3,
            maxCount: 5
        },
        corrupter: {
            defaultCount: 5,
            minCount: 3,
            maxCount: 7,
            preferredDeckSection: 'middle'
        }
    },
    storage: {
        key: 'savedConfig',
        testKey: '__storage_test__'
    }
};

const GAME_CONFIG = {
    corrupter: {
        defaultCount: 5,
        minCount: 3,
        maxCount: 7,
        preferredDeckSection: 'middle'
    },
    sentry: {
        defaultCount: 4,
        minCount: 3,
        maxCount: 5
    }
};

export { CONFIG, GAME_CONFIG };
