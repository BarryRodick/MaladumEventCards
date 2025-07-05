# Maladum: Card Actions Reference

This document provides a detailed explanation of the various card actions available in the Maladum Deck Builder app. Card actions allow you to manipulate the event deck during gameplay to create dynamic and strategic experiences.

## Available Card Actions

### 1. Shuffle into Remaining Deck
**Action Name:** `shuffleAnywhere`

**Description:**  
This action takes the current card and shuffles it randomly back into the remaining deck (all cards that haven't been drawn yet). This is useful when you want an event to potentially recur but not immediately.

**Behavior:**
- The current card is removed from its position
- The card is inserted at a random position among the remaining undrawn cards
- The next card in the sequence is then revealed

**Example Use Case:**  
When a threat appears that your party manages to drive away temporarily, but might return later in the expedition.

---

### 2. Shuffle into Next N Cards
**Action Name:** `shuffleTopN`

**Description:**  
This action places the current card somewhere within the next N cards of the deck. This creates a higher probability of the card reappearing soon compared to shuffling it into the entire remaining deck.

**Behavior:**
- You must specify a number (N) of cards
- The current card is removed from its position
- The card is shuffled into the next N cards in the deck
- If fewer than N cards remain, it shuffles into all remaining cards
- The next card in the sequence is then revealed

**Example Use Case:**  
When an enemy retreats but is likely to return very soon, or when a beneficial effect is temporary and will fade shortly.

---

### 3. Replace with Same Type
**Action Name:** `replaceSameType`

**Description:**
This action replaces the current card with another card of the same type from the available pool. This allows you to introduce variety while maintaining the same category of encounter. You can use it through the **Replace with same type** option in the deck builder.

**Behavior:**
- The current card is removed
- A new random card of the same type (e.g., Environment, Denizen, Dungeon) replaces it
- The new card is immediately revealed

**Example Use Case:**  
When you want to change the specific enemy or environment without changing the overall type of encounter.

**Note:** This functionality is fully implemented and available in the current version of the deck builder.

---

### 4. Introduce Sentry Cards
**Action Name:** `introduceSentry`

**Description:**  
This action introduces special "Sentry" cards (typically Revenants or Malagaunts) into the remaining deck. These represent elite enemies that arrive to challenge the party. This action is only available when Sentry Rules are enabled during deck creation.

**Behavior:**
- Sentry cards (that were set aside during deck generation) are shuffled into the remaining undrawn cards
- The current card remains in place
- The Sentry cards will appear randomly as you continue drawing
- Once introduced, Sentry cards cannot be introduced again (unless you regenerate the deck)

**Example Use Case:**  
When the party has triggered an alarm, made too much noise, or reached a certain point in the expedition that would draw the attention of more dangerous foes.

---

### 5. Insert Card by Type
**Action Name:** `insertCardType`

**Description:**  
This action allows you to add a new card of a specific type into the deck at a position of your choice.

**Behavior:**
- You select a card type (e.g., Denizen, Environment)
- You can either choose a specific card of that type or let the app select a random one
- You select where to insert it: next card, random position, or bottom of deck
- The current card remains unchanged

**Example Use Case:**  
When game mechanics require introducing a specific type of challenge, or when you want to ensure a certain type of encounter happens soon.

## Working with In-Play Cards

In addition to the card actions above, you can:

### Mark Card as In-Play
This places the current card in the "In-Play Cards" section at the bottom of the screen. This represents events that have ongoing effects throughout multiple turns.

### Remove Card from Play
This removes a card from the "In-Play Cards" section when its effects are no longer active.

### Clear All In-Play Cards
This removes all cards from the "In-Play Cards" section at once, which is useful when moving to a new area or scenario.

### Clear Active Card
Use the "Clear" button on the active card to hide it and show the card back. This is helpful when you want to pause the game without revealing a card. Clicking the button resets the current card index and preserves the game state.

## Tips for Using Card Actions

1. **Strategic Planning**: Use card actions to control the pacing and difficulty of your adventure. For example, introduce Sentry cards when the party feels too comfortable.

2. **Narrative Control**: These actions help you craft a more dynamic narrative that responds to player choices. If players take a noisy approach, introduce sentries sooner.

3. **Deck Management**: Keep track of which cards are in play and what actions you've taken to maintain a balanced experience.

4. **Saving State**: The app automatically saves your deck state when you perform actions, so you can close the app and return later without losing progress.

5. **Difficulty Adjustment**: Use these actions to adjust difficulty on-the-fly. If the party is struggling, you might choose not to introduce sentries, or if they're breezing through, add more challenging cards.

## Game State Persistence

The Maladum Deck Builder has been designed to maintain your game state even when you refresh the page or close your browser. This ensures your game session can be continued across multiple play sessions without losing progress.

### What Gets Saved

When you perform any action in the app, the following information is automatically saved:

- Current deck composition
- Current card index (which card you're viewing)
- Discard pile contents
- In-play cards
- Sentry cards (if using Sentry rules)
- Overall deck configuration and selections

### How to Resume Your Game

To resume your game where you left off:

1. Simply reopen the app in your browser
2. The app will automatically load your saved state
3. You'll see the same card you were viewing when you last closed the app
4. All your in-play cards will be restored
5. You can continue drawing cards and using card actions as before

### Troubleshooting

If your game state isn't persisting properly across page refreshes:

1. Make sure you're using the same browser and device where you started the game
2. Check that your browser allows local storage and cookies for this site
3. Ensure you're accessing the app through the same URL (e.g., always use http://localhost:8000 and not http://127.0.0.1:8000)
4. If issues persist, try clearing your browser cookies/storage and starting a new game.
