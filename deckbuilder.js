/**
 * deckbuilder.js - Entry point for the Maladum Event Cards application
 */
import { initializeApp } from './initialization.js';
import { setupEventListeners } from './events.js';

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});
