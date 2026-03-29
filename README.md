# Maladum Event Cards

Maladum Event Cards is a lightweight web app for managing the event deck and campaign tracking for the Maladum board game. It runs entirely in the browser and is hosted on GitHub Pages:

https://barryrodick.github.io/MaladumEventCards/

## Using the App

1. Open the GitHub Pages link.
2. Select the games/expansions you want to include.
3. Configure deck settings (difficulty, Sentry/Corrupter rules, and card counts per type).
4. Generate the deck, then tap the card image or press Next to draw.
5. Use **Prev** to go back, **In Play** to mark a card with an ongoing effect, and **Card Actions** to shuffle, replace, or insert cards.
6. Use **Search Cards** to find a specific card by name, preview it, and optionally shuffle it into the active deck.
7. Open **Campaign Manager** (scroll icon in the header) to track progress through Dungeons of Enveron or The Forbidden Creed.

- See [Card Actions Reference](cardActions.md) for details on manipulating the deck during play.

## Updates

Use the refresh icon in the header to check for updates. The app will prompt you if a new version is available.

## Image Notes

The campaign tracker pages let you attach photos from your device. Images are stored as Base64 data inside your browser's `localStorage`. Most browsers limit this storage to roughly 5 MB, so keep images small and few in number. All image data stays on your device and is never uploaded anywhere.

## License

This project is released under the [MIT License](LICENSE).

