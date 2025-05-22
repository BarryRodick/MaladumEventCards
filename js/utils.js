// Utility functions

export function shuffleDeck(deck) {
    let currentIndex = deck.length;
    let temporaryValue, randomIndex;

    // While there remain elements to shuffle
    while (0 !== currentIndex) {
        // Pick a remaining element
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // Swap it with the current element
        temporaryValue = deck[currentIndex];
        deck[currentIndex] = deck[randomIndex];
        deck[randomIndex] = temporaryValue;
    }

    return deck;
}

export function showToast(message) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        console.error('Element with ID "toastContainer" not found.');
        return;
    }

    const toast = document.createElement('div');
    toast.classList.add('toast', 'show', 'align-items-center', 'text-white', 'bg-secondary', 'border-0');
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    const toastBody = document.createElement('div');
    toastBody.classList.add('d-flex');
    const toastMessage = document.createElement('div');
    toastMessage.classList.add('toast-body');
    toastMessage.textContent = message;
    toastBody.appendChild(toastMessage);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.classList.add('ml-auto', 'mb-1', 'close');
    closeButton.setAttribute('data-dismiss', 'toast');
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.innerHTML = '<span aria-hidden="true">&times;</span>';
    toastBody.appendChild(closeButton);

    toast.appendChild(toastBody);
    toastContainer.appendChild(toast);

    // Automatically remove the toast after 3 seconds
    setTimeout(() => {
        $(toast).toast('hide');
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }, 3000);
}

export function trackEvent(eventCategory, eventAction, eventLabel = null, eventValue = null) {
    if (typeof gtag !== 'function') {
        console.warn('Google Analytics not available');
        return;
    }
    
    const eventParams = {
        event_category: eventCategory,
        event_label: eventLabel,
        value: eventValue,
        stream_id: '9783920401', // Replace with your actual stream_id if different
        stream_name: 'Maladum Event Cards' // Replace with your actual stream_name if different
    };
    
    // Remove undefined properties
    Object.keys(eventParams).forEach(key => 
        eventParams[key] === null && delete eventParams[key]
    );
    
    // Send the event to Google Analytics
    gtag('event', eventAction, eventParams);
    console.log('GA Event:', eventAction, eventParams);
}

export function isStorageAvailable() {
    try {
        const storage = window.localStorage; // Use a more specific reference if needed, e.g., localStorage
        const x = '__storage_test__';
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    } catch (e) {
        return false;
    }
}

export function findCardById(id) {
    // Search in availableCards (assuming availableCards is globally accessible or passed in)
    // This function might need access to global state or have state passed to it.
    // For now, assuming global `availableCards`, `setAsideCards`, `sentryDeck`, `dataStore` exist.
    // This will need to be refactored when these variables are moved to state.js.
    let card = availableCards.find(card => card.id === id);
    if (card) return card;

    card = setAsideCards.find(card => card.id === id);
    if (card) return card;

    card = sentryDeck.find(card => card.id === id);
    if (card) return card;

    for (let game in dataStore.games) {
        card = dataStore.games[game].find(card => card.id === id);
        if (card) return card;
    }

    console.error(`Card with ID ${id} not found.`);
    return null;
}

export function parseCardTypes(typeString) {
    // Split by + first to get AND groups
    const andGroups = typeString.split('+').map(group => group.trim());
    
    // For each AND group, split by / to get OR options
    const parsedGroups = andGroups.map(group => {
        const orOptions = group.split('/').map(option => option.trim());
        return orOptions;
    });

    return {
        andGroups: parsedGroups, // Array of arrays, each inner array contains OR options
        allTypes: [...new Set(parsedGroups.flat())] // Unique list of all types
    };
}
