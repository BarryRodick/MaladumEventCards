# Maladum Event Cards

Maladum Event Cards is a static browser app for managing event decks and campaign tracking for the Maladum board game. It runs entirely in the browser, stores state in `localStorage`, and is hosted on GitHub Pages:

[https://barryrodick.github.io/MaladumEventCards/](https://barryrodick.github.io/MaladumEventCards/)

## Runtime Model

The app now supports a mixed card catalog:

- `maladumcards.json` remains the legacy compatibility source and extraction seed.
- `data/cards/manifest.json` defines the structured rich-card catalog.
- `data/cards/*.json` store per-game structured cards with stable ids, tokenized text, footer metadata, and extraction state.
- `data/cards/icons.json` maps token names to local SVG assets in `assets/icons/`.

At runtime, cards from the legacy catalog normalize to `renderMode: "image"` and continue to render from `cardimages/*`. Cards from `data/cards/*.json` normalize to `renderMode: "rich"` and render from structured JSON with DOM-safe tokenized text.

## Card Format

Rich cards use bracket tokens inside text:

- `Take 2 [fire] damage.`
- `Move [move:3].`
- `Discard on a [skull].`

Inline tokens preserve printed word order. Legacy `[icon:fire]` syntax is accepted during migration and normalized to `[fire]`.

A rich card record looks like this:

```json
{
  "id": 50,
  "card": "Fresh Graves",
  "slug": "fresh-graves",
  "type": "Revenant + Veteran",
  "game": "Base Game",
  "sourceImage": "Fresh_Graves.png",
  "renderMode": "rich",
  "sections": [
    {
      "kind": "mode",
      "label": "DISQUIET",
      "text": "Increase Dread by 1 and shuffle this card back into the deck."
    }
  ],
  "footer": {
    "left": [{ "type": "icon", "name": "grave" }],
    "right": []
  },
  "tokens": {
    "style": "inline-bracket"
  },
  "searchText": "fresh graves revenant veteran increase dread by 1",
  "extraction": {
    "status": "needs-review",
    "confidence": 0.83,
    "issues": ["footer icons auto-detected"],
    "managedBy": "extractor"
  }
}
```

## Commands

Install build-time tooling once:

```bash
npm install
```

Common commands:

```bash
npm test
npm run validate:cards
npm run extract:cards
npm run extract:cards:openrouter
npm run review:cards
npm run build
```

Notes:

- `npm run extract:cards` runs the structured extractor with OCR enabled.
- `npm run extract:cards:openrouter` runs an optional multimodal enrichment pass against existing rich cards. It requires `OPENROUTER_API_KEY`.
- `npm run review:cards` builds `reports/card-review/index.html`.
- `npm run build` refreshes `service-worker.js` from `version.json` and rebuilds the cached asset manifest.

## Extraction Workflow

The extractor lives in `scripts/extract-cards.mjs` and works like this:

1. Read `maladumcards.json`.
2. Group cards by source image.
3. Inspect `cardimages/<contents>` with template-relative regions for title, section headers, bodies, and footer areas.
4. Seed structured sections from the existing legacy `sections` data.
5. Normalize inline icon tokens into bracket syntax.
6. Attempt OCR for region confirmation when enabled.
7. Emit per-game rich JSON, plus `data/cards/extraction-report.json`.
8. Optionally run `npm run extract:cards:openrouter` to improve seeded footer/icon extraction on cards that still need review.

Human-edited or verified records are preserved on rerun unless `--force` is passed.
The OpenRouter enrichment step only promotes clean automated results to `auto`; cards with unresolved icons or other ambiguity remain `needs-review`.

## Reviewing And Editing Cards

Manual review is expected during migration.

- Open [reports/card-review/index.html](reports/card-review/index.html) after running `npm run review:cards`.
- Compare the source image on the left with the structured render and raw extraction metadata on the right.
- Cards are marked `auto`, `needs-review`, or `verified`.
- Keep uncertain text or icons explicit. Use placeholders like `[unknown-icon]` rather than guessing.

If you manually fix a card, update its `extraction` block accordingly. Use `managedBy: "human"` or `status: "verified"` for records that should not be overwritten by a later extractor rerun without `--force`.

## Adding Or Editing Cards

For a new or updated card:

1. Add or update the legacy entry in `maladumcards.json` if needed.
2. Run `npm run extract:cards`.
3. Review the generated rich record in `data/cards/<game>.json`.
4. Correct text, footer metadata, tags, or extraction flags.
5. Run `npm run validate:cards` and `npm test`.
6. Run `npm run review:cards` if you want a visual review page.

## Adding Icons

1. Add an SVG under `assets/icons/`.
2. Register it in `data/cards/icons.json` with `aliases`, `kind`, `asset`, and notes.
3. Use the icon name inside bracket tokens such as `[fire]` or `[move:3]`.
4. Run `npm run validate:cards`.

## Migration Notes

- The deck builder, type parsing, and stable ids are unchanged.
- Search now uses title, type, game, and extracted rules text via normalized `searchText`.
- Legacy image-backed cards still work during migration because normalization preserves `contents` and `sourceImage`.
- The service worker now caches structured card JSON and local SVG icon assets as part of the app shell.

## Current Extractor Limitations

- Footer icon matching is intentionally conservative and currently defaults many detected footer glyphs to `unknown-icon`.
- OCR is used as confirmation and review input, not as an unquestioned source of truth.
- Complex inline icon extraction from body text still relies heavily on legacy seeded text and needs manual review when placeholders remain.

## License

This project is released under the [MIT License](LICENSE).
