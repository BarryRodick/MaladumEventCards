// JavaScript for Dungeons of Enveron Campaign Tracker

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all event listeners and load state AFTER partials are loaded by htmlLoader.js
    // (assuming htmlLoader.js is used and has completed its work if this page is refactored to use it)

    // Event listeners for checkboxes, inputs, etc.
    document.querySelectorAll('.checkbox').forEach(checkbox => {
        checkbox.addEventListener('click', function() {
            if (this.style.backgroundColor === 'black') {
                this.style.backgroundColor = '';
            } else {
                this.style.backgroundColor = 'black';
            }
            saveState();
        });
    });

    document.querySelectorAll('.circle').forEach(circle => {
        circle.addEventListener('click', function() {
            if (!this.classList.contains('numbered-circle')) {
                if (this.classList.contains('blue-border')) {
                    this.classList.remove('blue-border');
                    this.classList.add('red-border');
                } else if (this.classList.contains('red-border')) {
                    this.classList.remove('red-border');
                    this.classList.add('empty');
                } else {
                    this.classList.remove('empty');
                    this.classList.add('blue-border');
                }
                saveState();
            }
        });
    });

    document.querySelectorAll('.numbered-circle').forEach(circle => {
        circle.addEventListener('click', function() {
            if (this.style.backgroundColor === 'black') {
                this.style.backgroundColor = '';
                this.style.color = 'black';
            } else {
                this.style.backgroundColor = 'black';
                this.style.color = 'white';
            }
            saveState();
        });
    });

    document.querySelectorAll('.input-field').forEach(input => {
        input.addEventListener('input', saveState);
    });

    document.querySelectorAll('.delay-checkbox').forEach(checkbox => {
        checkbox.addEventListener('click', function() {
            if (this.style.backgroundColor === 'black') {
                this.style.backgroundColor = '';
            } else {
                this.style.backgroundColor = 'black';
            }
            saveState();
        });
    });

    const notesContent = document.getElementById('notesContent');
    const notesTextarea = document.getElementById('notesTextarea');
    // Ensure collapseIcon is correctly scoped if this code is used with HTML partials later
    const notesHeader = document.querySelector('.notes-header'); // Or specific ID if added to partial
    const collapseIcon = notesHeader ? notesHeader.querySelector('.collapse-icon') : null;


    // toggleNotes might be attached via onclick in HTML or an event listener here.
    // If HTML has onclick="toggleNotes()", this function needs to be global.
    // If attaching here, ensure notesHeader is valid.
    window.toggleNotes = function() { // Made global for existing onclick
        if (notesContent) notesContent.classList.toggle('visible');
        if (collapseIcon) collapseIcon.classList.toggle('rotated');
        saveState();
    }
    // If removing onclick, add listener:
    // if (notesHeader) {
    //     notesHeader.addEventListener('click', toggleNotes);
    // }


    document.querySelectorAll('.malagaunt-checkbox').forEach(checkbox => {
        checkbox.addEventListener('click', function() {
            if (this.style.backgroundColor === 'black') {
                this.style.backgroundColor = '';
            } else {
                this.style.backgroundColor = 'black';
            }
            saveState();
        });
    });

    if (notesTextarea) {
        notesTextarea.addEventListener('input', saveState);
    }
    
    // Load initial state
    if (isStorageAvailable()) {
        loadState();
    }

    // Add reset button
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Campaign';
    resetButton.className = 'reset-button';
    resetButton.addEventListener('click', function() {
        if (confirm('Are you sure you want to reset the campaign? This will clear all progress.')) {
            localStorage.removeItem('dungeonState');
            location.reload();
        }
    });
    // Check if a reset button already exists to prevent duplicates if script runs multiple times (e.g. HMR)
    if (!document.body.querySelector('.reset-button')) {
        document.body.appendChild(resetButton);
    }
});


function isStorageAvailable() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch(e) {
        console.warn('Local storage is not available');
        return false;
    }
}

function saveState() {
    try {
        if (!isStorageAvailable()) {
            console.warn('Local storage is not available');
            return;
        }
        
        const notesContent = document.getElementById('notesContent'); // Re-fetch in case of dynamic load
        const notesTextarea = document.getElementById('notesTextarea'); // Re-fetch

        const state = {
            checkboxGroups: Array.from(document.querySelectorAll('.checkbox-group')).map(group => 
                Array.from(group.querySelectorAll('.checkbox')).map(cb => cb.style.backgroundColor === 'black')
            ),
            // Be more specific with checkbox selection to avoid including those in checkboxGroups again
            checkboxes: Array.from(document.querySelectorAll('.achievement-row .checkbox, .reward-item .checkbox, .apprentice-section .checkbox, .entry-point-item .checkbox')).filter(cb => !cb.closest('.checkbox-group')).map(cb => cb.style.backgroundColor === 'black'),
            delayTrack: Array.from(document.querySelectorAll('.delay-checkbox')).map(cb => cb.style.backgroundColor === 'black'),
            malagauntTrack: Array.from(document.querySelectorAll('.malagaunt-checkbox')).map(cb => cb.style.backgroundColor === 'black'),
            numberedCircles: Array.from(document.querySelectorAll('.numbered-circle')).map(circle => circle.style.backgroundColor === 'black'),
            inputs: Array.from(document.querySelectorAll('.input-field')).map(input => input.value),
            notes: notesTextarea ? notesTextarea.value : '',
            notesVisible: notesContent ? notesContent.classList.contains('visible') : false
        };
        localStorage.setItem('dungeonState', JSON.stringify(state));
    } catch (e) {
        console.warn('Error saving state:', e);
    }
}

function loadState() {
    try {
        if (!isStorageAvailable()) {
            console.warn('Local storage is not available');
            return;
        }
        
        const savedState = localStorage.getItem('dungeonState');
        if (savedState) {
            const state = JSON.parse(savedState);
            
            document.querySelectorAll('.checkbox-group').forEach((group, groupIndex) => {
                const groupState = state.checkboxGroups?.[groupIndex];
                if(groupState) {
                    group.querySelectorAll('.checkbox').forEach((cb, cbIndex) => {
                        cb.style.backgroundColor = groupState[cbIndex] ? 'black' : '';
                    });
                }
            });

            Array.from(document.querySelectorAll('.achievement-row .checkbox, .reward-item .checkbox, .apprentice-section .checkbox, .entry-point-item .checkbox')).filter(cb => !cb.closest('.checkbox-group')).forEach((cb, i) => {
                 if(state.checkboxes && typeof state.checkboxes[i] !== 'undefined') {
                    cb.style.backgroundColor = state.checkboxes[i] ? 'black' : '';
                 }
            });

            document.querySelectorAll('.delay-checkbox').forEach((cb, i) => {
                if(state.delayTrack && typeof state.delayTrack[i] !== 'undefined') {
                    cb.style.backgroundColor = state.delayTrack[i] ? 'black' : '';
                }
            });

            document.querySelectorAll('.numbered-circle').forEach((circle, i) => {
                if(state.numberedCircles && typeof state.numberedCircles[i] !== 'undefined') {
                    if (state.numberedCircles[i]) {
                        circle.style.backgroundColor = 'black';
                        circle.style.color = 'white';
                    } else {
                        circle.style.backgroundColor = '';
                        circle.style.color = 'black';
                    }
                }
            });

            document.querySelectorAll('.input-field').forEach((input, i) => {
                if(state.inputs && typeof state.inputs[i] !== 'undefined') {
                    input.value = state.inputs[i] || '';
                }
            });
            
            const notesTextarea = document.getElementById('notesTextarea');
            if (notesTextarea && typeof state.notes === 'string') {
                notesTextarea.value = state.notes;
            }
            
            const notesContent = document.getElementById('notesContent');
            // Ensure collapseIcon is correctly scoped if this code is used with HTML partials later
            const notesHeader = document.querySelector('.notes-header'); // Or specific ID
            const collapseIcon = notesHeader ? notesHeader.querySelector('.collapse-icon') : null;

            if (notesContent && state.notesVisible) {
                notesContent.classList.add('visible');
                if (collapseIcon) collapseIcon.classList.add('rotated');
            } else if (notesContent) {
                notesContent.classList.remove('visible');
                if (collapseIcon) collapseIcon.classList.remove('rotated');
            }

            document.querySelectorAll('.malagaunt-checkbox').forEach((cb, i) => {
                if(state.malagauntTrack && typeof state.malagauntTrack[i] !== 'undefined') {
                    cb.style.backgroundColor = state.malagauntTrack[i] ? 'black' : '';
                }
            });
        }
    } catch (e) {
        console.warn('Error loading state:', e);
    }
}
