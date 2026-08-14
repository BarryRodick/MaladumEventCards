# Project Context

## Purpose

Maladum Event Cards is the canonical static browser app for building Maladum event decks, running a live deck, searching the structured card catalog, and tracking campaigns. GitHub Pages serves the checked-in HTML, JavaScript, JSON, and assets; Node.js is local maintenance and validation tooling only.

## Canonical Repository

`BarryRodick/MaladumEventCards` is the sole development repository. Treat the former `BarryRodick/maladum-rich-event-cards` split repository as a reconciled donor pending archival; it must not receive new product work.

The reconciliation decision and commit-by-commit disposition are recorded in [ADR 0001](docs/adr/0001-consolidate-rich-event-cards.md).

## Current Product State

- The structured catalog contains 142 human-verified cards across seven game files.
- `maladumcards.json` remains the legacy compatibility source and extraction seed.
- Main's `deck-rules.js`, `live-deck.js`, `live-deck-session.js`, `live-deck-view.js`, `app-snapshot.js`, and `campaign-tracker.js` are the authoritative runtime architecture.
- Browser state is local to the user's `localStorage`; the app has no application server or account system.

## Validation

Run these checks before merging card or runtime changes:

```bash
npm ci
npm run build
npm test
npm run validate:cards
git diff --check
```

`npm run build` synchronizes the version and offline asset manifest. Review generated changes before committing.

## Work Tracking

Use this repository's GitHub Issues and the canonical triage labels documented in `docs/agents/`.
