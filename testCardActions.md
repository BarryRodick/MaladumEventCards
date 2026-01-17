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
4. Select "Shuffle into remaining deck" from the Card Action dropdown
5. Click "APPLY ACTION"
6. Verify that a success message appears
7. Continue drawing cards by clicking "NEXT" several times
8. Confirm the shuffled card reappears later in the deck
9. Verify the deck progress bar updates correctly

### Test 3: Shuffle into Next N Cards

1. Generate a new deck with at least 10 cards
2. Draw several cards by clicking "NEXT" (at least 3)
3. Note the current card's name and type
4. Select "Shuffle into next N cards" from the Card Action dropdown
5. Set N to 3
6. Click "APPLY ACTION"
7. Verify that a success message appears
8. Draw the next 3 cards by clicking "NEXT" 3 times
9. Confirm the shuffled card reappears within those 3 cards
10. Verify the deck progress bar updates correctly

### Test 4: Replace with Same Type

1. Generate a new deck with at least 5 cards of several different types
2. Draw cards by clicking "NEXT" until you see a card of a type for which there are other cards available
3. Note the current card's name and type
4. Select "Replace with same type" from the Card Action dropdown
5. Click "APPLY ACTION"
6. Verify that a success message appears indicating replacement
7. Confirm the new card has the same type as the original card
8. Verify the deck progress bar doesn't change (card count should remain the same)

### Test 5: Introduce Sentry Cards

1. Generate a new deck with Sentry Rules enabled
2. Draw several cards by clicking "NEXT"
3. Select "Introduce Sentry cards" from the Card Action dropdown
4. Click "APPLY ACTION"
5. Verify that a success message appears
6. Continue drawing cards by clicking "NEXT"
7. Confirm that Sentry cards (Revenants or Malagaunts) appear in the deck
8. Try using "Introduce Sentry cards" again and verify it fails (as the cards have already been introduced)

### Test 6: Insert Card by Type

1. Generate a new deck with various card types
2. Draw several cards by clicking "NEXT"
3. Select "Insert card by type" from the Card Action dropdown
4. In the dropdown that appears, select a card type (e.g., "Environment")
5. Optionally, select a specific card of that type
6. Choose an insertion position (e.g., "Next Card")
7. Click "APPLY ACTION"
8. Verify that a success message appears
9. If you chose "Next Card," click "NEXT" once and confirm the inserted card appears
10. Verify the deck progress bar updates to show an additional card

### Test 7: In-Play Cards

1. Generate a new deck
2. Draw a card by clicking "NEXT"
3. Click "MARK IN PLAY"
4. Verify the card appears in the "In Play Cards" section
5. Draw another card and mark it in play as well
6. Verify both cards are shown in the "In Play Cards" section
7. Click the "Remove from Play" button on one of the in-play cards
8. Verify that card is removed while the other remains
9. Click "CLEAR IN-PLAY CARDS"
10. Verify all in-play cards are removed

### Test 8: Game State Persistence

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