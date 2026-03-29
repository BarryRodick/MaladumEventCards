# Maladum Card Actions Testing Guide

This document provides step-by-step instructions to test each card action in the Maladum Deck Builder.

## Prerequisites

1. Make sure you are accessing the application through http://localhost:8000 or your preferred URL consistently
2. Ensure you have at least two games selected in the game setup (for greater card variety)
3. Enable both Sentry Rules and Corrupter Rules

## Testing Procedure

### Test 1: Basic Deck Generation

1. Select 3-4 games in the "Select Games" section
2. Set at least one card count for each type to 1 or higher
3. Click "GENERATE DECK"
4. Verify that the first card appears (showing "back.jpg")
5. Click "NEXT" to draw the first card
6. Confirm the current card is displayed
7. Check that the progress bar and card count update correctly

### Test 2: Shuffle into Remaining Deck

1. Generate a deck with at least 10 cards
2. Draw several cards by clicking "NEXT" (at least 3)
3. Note the current card's name and type
4. In the Card Actions grid, click "Shuffle Back Into Deck"
5. Verify that a success toast message appears
6. Verify the previous card (or card back) is now shown
7. Continue drawing cards by clicking "NEXT" several times
8. Confirm the shuffled card reappears later in the deck
9. Verify the deck progress bar updates correctly

### Test 3: Shuffle into Next N Cards

1. Generate a new deck with at least 10 cards
2. Draw several cards by clicking "NEXT" (at least 3)
3. Note the current card's name and type
4. In the Card Actions grid, click "Shuffle Top N"
5. A configuration panel appears — set N to 3 using the +/- buttons or the input
6. Click "Confirm"
7. Verify that a success toast message appears
8. Draw the next 3 cards by clicking "NEXT" 3 times
9. Confirm the shuffled card reappears within those 3 cards
10. Verify the deck progress bar updates correctly

### Test 4: Replace with Same Type

1. Generate a new deck with at least 5 cards of several different types
2. Draw cards by clicking "NEXT" until you see a card of a type for which there are other cards available
3. Note the current card's name and type
4. In the Card Actions grid, click "Replace"
5. Verify that a success toast message appears indicating replacement
6. Confirm the new card has the same type as the original card
7. Verify the deck progress bar doesn't change (card count should remain the same)

### Test 5: Introduce Sentry Cards

1. Generate a new deck with Sentry Rules enabled
2. Draw several cards by clicking "NEXT"
3. In the Card Actions grid, click "Sentry"
4. Verify that a success toast message appears indicating how many Sentry cards were shuffled in
5. Continue drawing cards by clicking "NEXT"
6. Confirm that Sentry cards (Revenants, Malagaunts, or Cabal) appear in the deck
7. Try clicking "Sentry" again and verify it reports no Sentry cards available (they have already been introduced)

### Test 6: Insert Card by Type

1. Generate a new deck with various card types
2. Draw several cards by clicking "NEXT"
3. In the Card Actions grid, click "Insert Card"
4. A configuration panel appears with Card Type, Specific Card, and Position controls
5. Select a card type (e.g., "Environment")
6. Optionally, select a specific card from the second dropdown (defaults to "Random")
7. Choose an insertion position: Next, Random, or Bottom
8. Click "Confirm"
9. Verify that a success toast message appears
10. If you chose "Next," click "NEXT" once and confirm the inserted card appears
11. Verify the deck progress bar updates to show an additional card
12. Test the "Cancel" button to verify the panel closes without inserting

### Test 7: In-Play Cards

1. Generate a new deck
2. Draw a card by clicking "NEXT"
3. Click "In Play"
4. Verify the card appears in the "In Play Cards" section
5. Draw another card and mark it in play as well
6. Verify both cards are shown in the "In Play Cards" section
7. Click the "Remove from Play" button on one of the in-play cards
8. Verify that card is removed while the other remains
9. Click "Clear All"
10. Verify all in-play cards are removed

### Test 8: Card Search and Shuffle from Preview

1. Generate a new deck with at least 10 cards
2. Draw several cards by clicking "NEXT"
3. Expand the "Search Cards" section
4. Type a card name (or partial name) into the search input
5. Verify matching cards appear in the results list
6. Click a card result to open the card preview modal
7. Verify the modal shows the card image, name, and type
8. Set "Shuffle into top X cards" to a number (e.g., 6)
9. Click "Shuffle"
10. Verify a success toast message appears
11. Draw the next several cards and confirm the shuffled card appears within the expected range
12. Test shuffling a card that is already in the deck at another position — verify it is moved, not duplicated
13. Test shuffling the currently active card — verify the action is blocked with a toast message

### Test 9: Clear Active Card

1. Generate a new deck and draw a card
2. Click the X button on the active card
3. Verify the card back is shown
4. Click "NEXT" to draw — verify the same card is drawn again (it was not discarded)

### Test 10: Discard Pile Reshuffle

1. Generate a small deck (3-4 cards)
2. Draw all cards by clicking "NEXT" through the entire deck
3. When the last card is passed, verify a toast saying "Deck reshuffled from discard pile" appears
4. Verify the card back is shown and the progress bar resets
5. Continue drawing to confirm the reshuffled deck contains the previously drawn cards

### Test 11: Game State Persistence

1. Generate a new deck
2. Draw several cards (at least 5)
3. Mark at least one card as in play
4. Perform one of the card actions (e.g., Shuffle into remaining deck)
5. **Refresh the page**
6. Verify that:
   - The same card is displayed as before refresh
   - The progress bar shows the correct position
   - The in-play card is still shown
   - The deck size remains the same
7. Continue drawing cards to ensure the deck behaves as expected

## Reporting Issues

If any test fails, note:
- The exact steps you took
- What you expected to happen
- What actually happened
- Any error messages in the browser console (F12 to view)
- The browser and device you're using 