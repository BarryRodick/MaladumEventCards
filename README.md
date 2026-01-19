# Maladum Event Cards

Maladum Event Cards is a lightweight web app for managing the event deck and campaign tracking for the Maladum board game. It runs entirely in the browser and is hosted on GitHub Pages:

https://barryrodick.github.io/MaladumEventCards/

## Using the App

1. Open the GitHub Pages link.
2. Select the games/expansions you want to include.
3. Configure deck settings (difficulty, rules, and card counts).
4. Generate the deck, then tap the card image to draw the next card.
5. Use Prev/In Play to track active cards and open Card Actions to shuffle or replace cards.
6. Open Campaign Manager to track your campaign progress.

- See [Card Actions Reference](cardActions.md) for details on manipulating the deck during play.

## Updates

Use the refresh icon in the header to check for updates. The app will prompt you if a new version is available.

## Image Notes

The campaign tracker pages let you attach photos from your device. Images are stored as Base64 data inside your browser's `localStorage`. Most browsers limit this storage to roughly 5 MB, so keep images small and few in number. All image data stays on your device and is never uploaded anywhere.

## License

This project is released under the [MIT License](LICENSE).

