import * as storageUtils from './storage-utils.js';

const DEFAULT_OPTIONS = {
    checkboxSelector: '.checkbox',
    checkboxMode: 'style',
    checkboxActiveColor: 'black',
    inputSelector: '.input-field',
    notesContentId: 'notesContent',
    notesTextareaId: 'notesTextarea',
    collapseIconSelector: '.collapse-icon',
    notesToggleSelector: '[data-toggle-notes]',
    imageInputId: 'imageInput',
    imageGalleryId: 'imageGallery',
    imageModalId: 'imageModal',
    modalImageId: 'modalImage',
    binaryTracks: [],
    cycleClassControls: []
};

export function initializeCampaignTracker(options = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const doc = config.document || document;
    const storage = config.storage || storageUtils;
    const trackerState = { images: [] };

    const elements = {
        notesContent: doc.getElementById(config.notesContentId),
        notesTextarea: doc.getElementById(config.notesTextareaId),
        collapseIcon: doc.querySelector(config.collapseIconSelector),
        imageInput: doc.getElementById(config.imageInputId),
        imageGallery: doc.getElementById(config.imageGalleryId),
        imageModal: doc.getElementById(config.imageModalId),
        modalImage: doc.getElementById(config.modalImageId)
    };

    const saveState = () => saveCampaignState(doc, storage, config, elements, trackerState);
    const loadState = () => loadCampaignState(doc, storage, config, elements, trackerState, saveState);
    const renderGallery = () => renderImageGallery(doc, config, elements, trackerState, saveState);

    bindCheckboxes(doc, config, saveState);
    bindBinaryTracks(doc, config, saveState);
    bindCycleClassControls(doc, config, saveState);
    bindInputs(doc, config, saveState);
    bindNotesToggle(doc, config, elements, saveState);
    bindNotesInput(elements, saveState);
    bindImages(config, elements, trackerState, renderGallery, saveState);

    if (!storage.isStorageAvailable || storage.isStorageAvailable()) {
        loadState();
    }

    return {
        saveState,
        loadState,
        renderGallery,
        getImages: () => [...trackerState.images]
    };
}

function bindCheckboxes(doc, config, saveState) {
    doc.querySelectorAll(config.checkboxSelector).forEach(checkbox => {
        checkbox.addEventListener('click', function () {
            setChecked(this, !isChecked(this, config.checkboxMode), config.checkboxMode, config.checkboxActiveColor);
            saveState();
        });
    });
}

function bindBinaryTracks(doc, config, saveState) {
    config.binaryTracks.forEach(track => {
        doc.querySelectorAll(track.selector).forEach(element => {
            element.addEventListener('click', function () {
                setChecked(this, !isChecked(this, track.mode), track.mode, track.activeColor || 'black');
                saveState();
            });
        });
    });
}

function bindCycleClassControls(doc, config, saveState) {
    config.cycleClassControls.forEach(control => {
        doc.querySelectorAll(control.selector).forEach(element => {
            element.addEventListener('click', function () {
                if (control.excludeClass && this.classList.contains(control.excludeClass)) return;
                cycleClassState(this, control);
                saveState();
            });
        });
    });
}

function bindInputs(doc, config, saveState) {
    doc.querySelectorAll(config.inputSelector).forEach(input => {
        input.addEventListener('input', saveState);
    });
}

function bindNotesToggle(doc, config, elements, saveState) {
    const toggle = doc.querySelector(config.notesToggleSelector);
    if (!toggle || !elements.notesContent || !elements.collapseIcon) return;

    toggle.addEventListener('click', () => {
        elements.notesContent.classList.toggle('visible');
        elements.collapseIcon.classList.toggle('rotated');
        saveState();
    });
}

function bindNotesInput(elements, saveState) {
    if (elements.notesTextarea) {
        elements.notesTextarea.addEventListener('input', saveState);
    }
}

function bindImages(config, elements, trackerState, renderGallery, saveState) {
    if (elements.imageModal) {
        elements.imageModal.addEventListener('click', () => elements.imageModal.classList.remove('show'));
    }

    if (!elements.imageInput) return;

    elements.imageInput.addEventListener('change', event => {
        Array.from(event.target.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = loadEvent => {
                trackerState.images.push(loadEvent.target.result);
                renderGallery();
                saveState();
            };
            reader.readAsDataURL(file);
        });
        elements.imageInput.value = '';
    });
}

function saveCampaignState(doc, storage, config, elements, trackerState) {
    try {
        storage.saveState(config.storageKey, captureCampaignState(doc, config, elements, trackerState));
    } catch (error) {
        console.warn('Error saving state:', error);
    }
}

export function captureCampaignState(doc, config, elements, trackerState) {
    const state = {
        checkboxes: Array.from(doc.querySelectorAll(config.checkboxSelector)).map(element =>
            isChecked(element, config.checkboxMode)
        ),
        inputs: Array.from(doc.querySelectorAll(config.inputSelector)).map(input => input.value),
        notes: elements.notesTextarea ? elements.notesTextarea.value : '',
        notesVisible: elements.notesContent ? elements.notesContent.classList.contains('visible') : false,
        images: trackerState.images
    };

    if (config.checkboxGroupSelector) {
        state.checkboxGroups = Array.from(doc.querySelectorAll(config.checkboxGroupSelector)).map(group =>
            Array.from(group.querySelectorAll(config.checkboxSelector)).map(element =>
                isChecked(element, config.checkboxMode)
            )
        );
    }

    config.binaryTracks.forEach(track => {
        state[track.stateKey] = Array.from(doc.querySelectorAll(track.selector)).map(element =>
            isChecked(element, track.mode)
        );
    });

    return state;
}

function loadCampaignState(doc, storage, config, elements, trackerState, saveState) {
    try {
        const state = storage.loadState(config.storageKey);
        if (!state) return;
        applyCampaignState(doc, config, elements, trackerState, state, saveState);
    } catch (error) {
        console.warn('Error loading state:', error);
    }
}

export function applyCampaignState(doc, config, elements, trackerState, state, saveState = () => { }) {
    if (state.notes && elements.notesTextarea) {
        elements.notesTextarea.value = state.notes;
    }

    if (state.notesVisible && elements.notesContent && elements.collapseIcon) {
        elements.notesContent.classList.add('visible');
        elements.collapseIcon.classList.add('rotated');
    }

    restoreCheckboxGroups(doc, config, state);
    restoreCheckboxes(doc, config, state);
    restoreBinaryTracks(doc, config, state);
    restoreInputs(doc, config, state);

    trackerState.images = state.images || [];
    renderImageGallery(doc, config, elements, trackerState, saveState);
}

function restoreCheckboxGroups(doc, config, state) {
    if (!config.checkboxGroupSelector || !state.checkboxGroups) return;

    doc.querySelectorAll(config.checkboxGroupSelector).forEach((group, groupIndex) => {
        group.querySelectorAll(config.checkboxSelector).forEach((checkbox, checkboxIndex) => {
            setChecked(
                checkbox,
                !!state.checkboxGroups?.[groupIndex]?.[checkboxIndex],
                config.checkboxMode,
                config.checkboxActiveColor
            );
        });
    });
}

function restoreCheckboxes(doc, config, state) {
    const checkboxes = Array.from(doc.querySelectorAll(config.checkboxSelector));
    if (!Array.isArray(state.checkboxes)) return;

    if (state.checkboxes.length === checkboxes.length) {
        checkboxes.forEach((checkbox, index) => {
            setChecked(checkbox, !!state.checkboxes[index], config.checkboxMode, config.checkboxActiveColor);
        });
        return;
    }

    if (!config.legacyCheckboxSelector) return;

    Array.from(doc.querySelectorAll(config.legacyCheckboxSelector))
        .filter(item => !config.legacyCheckboxExcludeSelector || !item.querySelector(config.legacyCheckboxExcludeSelector))
        .map(item => item.querySelector(config.checkboxSelector))
        .filter(Boolean)
        .forEach((checkbox, index) => {
            setChecked(checkbox, !!state.checkboxes?.[index], config.checkboxMode, config.checkboxActiveColor);
        });
}

function restoreBinaryTracks(doc, config, state) {
    config.binaryTracks.forEach(track => {
        if (!Array.isArray(state[track.stateKey])) return;
        doc.querySelectorAll(track.selector).forEach((element, index) => {
            setChecked(element, !!state[track.stateKey][index], track.mode, track.activeColor || 'black');
        });
    });
}

function restoreInputs(doc, config, state) {
    if (!Array.isArray(state.inputs)) return;
    doc.querySelectorAll(config.inputSelector).forEach((input, index) => {
        input.value = state.inputs[index] || '';
    });
}

function renderImageGallery(doc, config, elements, trackerState, saveState) {
    if (!elements.imageGallery) return;

    elements.imageGallery.innerHTML = '';
    trackerState.images.forEach((src, index) => {
        const wrapper = doc.createElement('div');
        wrapper.className = 'image-item';

        const img = doc.createElement('img');
        img.src = src;
        img.addEventListener('click', () => openImageModal(elements, src));

        const btn = doc.createElement('button');
        btn.textContent = 'Remove';
        btn.addEventListener('click', () => {
            trackerState.images.splice(index, 1);
            renderImageGallery(doc, config, elements, trackerState, saveState);
            saveState();
        });

        wrapper.appendChild(img);
        wrapper.appendChild(btn);
        elements.imageGallery.appendChild(wrapper);
    });
}

function openImageModal(elements, src) {
    if (!elements.modalImage || !elements.imageModal) return;
    elements.modalImage.src = src;
    elements.imageModal.classList.add('show');
}

function isChecked(element, mode) {
    if (mode === 'dataset') {
        return element.dataset.checked === 'true';
    }
    return !!element.style.backgroundColor;
}

function setChecked(element, checked, mode, activeColor) {
    if (mode === 'dataset') {
        element.dataset.checked = checked ? 'true' : '';
    }

    element.style.backgroundColor = checked ? activeColor : '';

    if (mode === 'numbered') {
        element.style.color = checked ? 'white' : 'black';
    }
}

function cycleClassState(element, control) {
    if (element.classList.contains(control.firstClass)) {
        element.classList.remove(control.firstClass);
        element.classList.add(control.secondClass);
        return;
    }

    if (element.classList.contains(control.secondClass)) {
        element.classList.remove(control.secondClass);
        element.classList.add(control.emptyClass);
        return;
    }

    element.classList.remove(control.emptyClass);
    element.classList.add(control.firstClass);
}
