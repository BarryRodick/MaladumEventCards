# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Maladum Event Cards is a browser-based PWA for managing event card decks and campaign tracking for the Maladum board game. It is a static site hosted on GitHub Pages with no build toolchain beyond a version-sync script. All state is persisted in `localStorage`.

Live site: https://barryrodick.github.io/MaladumEventCards/

## Commands

- **Run all tests:** `npm test`
- **Run a single test suite:** `node tests/parseCardTypes.test.js` (or `deckGeneration`, `cardActions`, `storageUtils`)
- **Build (sync version to service worker):** `npm run build` (reads `version.json`, stamps `service-worker.js`)

Tests are plain Node.js scripts with `assert` — no test framework.

## Architecture

The app is vanilla JavaScript using ES modules loaded directly by the browser (no bundler). Bootstrap is used for UI components. The HTML pages are self-contained entry points:

- `index.html` — Main deck builder (Maladum base game)
- `dungeons_of_enveron.html` / `forbidden_creed.html` — Expansion-specific pages with campaign trackers
- `about.html` — About/info page

### Module Dependency Graph

```
initialization.js  (app entry — fetches JSON data, restores saved state, registers service worker)
  ├── state.js         (central CONFIG + mutable state singleton, shared by all modules)
  ├── config-manager.js (save/load config via localStorage)
  │   └── storage-utils.js (low-level localStorage helpers)
  ├── ui-manager.js    (DOM generation: game selection, card type inputs, difficulty, search)
  ├── deck-manager.js  (deck generation, card navigation, display, progress bar)
  ├── card-actions.js  (in-play tracking, shuffle/replace/insert actions during gameplay)
  ├── card-utils.js    (parseCardTypes for "A/B+C" type strings, Fisher-Yates shuffle)
  └── app-utils.js     (debounce, gtag tracking, toast notifications)
```

### Key Concepts

- **Card type strings** use a DSL: `+` means AND (card counts against multiple types), `/` means OR (either type satisfies). `parseCardTypes()` in `card-utils.js` parses these into `{ andGroups, allTypes }`.
- **Special card categories** defined in `maladumcards.json`: `sentryTypes`, `corrupterTypes`, and `heldBackCardTypes` each have distinct deck-building rules (held aside, shuffled in later, or replace regular cards).
- **State singleton** (`state.js`): all modules import and mutate the shared `state` object. `CONFIG` holds immutable defaults. `window.appState` is exposed for debugging.
- **Service worker** (`service-worker.js`) enables offline use. Version is kept in `version.json` and synced to the service worker via `npm run build`.

### Data Files

- `maladumcards.json` — All card definitions keyed by game/expansion, plus type metadata arrays
- `difficulties.json` — Difficulty presets with card count recommendations
- `version.json` — App version, read by build script and update-check logic

## Code Style

- 4-space indentation, UTF-8, LF line endings (see `.editorconfig`)
- JSON files use 2-space indentation
- ES module imports/exports (no CommonJS in browser code; tests and scripts use CommonJS)
