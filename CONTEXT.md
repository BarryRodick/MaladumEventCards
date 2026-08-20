# Project Context

## Purpose

Maladum Event Cards is the canonical static browser app for building Maladum event decks, running a live deck, searching the structured card catalog, and tracking campaigns. GitHub Pages serves the checked-in HTML, JavaScript, JSON, and assets; Node.js is local maintenance and validation tooling only.

## Language

**Card Catalog**:
The searchable collection of Maladum event cards, drawn from legacy image records and structured rich records.
_Avoid_: card data, card list

**Card Catalog acceptance policy**:
The domain rules that decide whether a Card Catalog candidate is usable for the current session and whether it may replace the last-known-good snapshot.
_Avoid_: catalog validation, card validation

### Minimum viable Card Catalog invariant

The checked-in legacy and structured sources agree on seven required games and 142 globally unique card IDs. A runtime Card Catalog is usable only when all seven game groups are present and non-empty; every card has a positive integer ID, title, type, matching game, and source image; IDs are globally unique; the Sentry, Corrupter, and held-back rule-type collections are present; and at least one named difficulty profile has non-negative integer Novice and Veteran adjustments.

Successful transport is not proof of valid data. Empty or malformed legacy, difficulty, manifest, icon, or rich-game payloads make an acquisition incomplete. An incomplete acquisition may be used for the current session only when its merged Card Catalog still satisfies the invariant. It must not replace the versioned atomic last-known-good snapshot.

A complete candidate may replace that snapshot only when it is not lower in any durable quality dimension: total cards, rich-renderable cards, icon entries, manifest game coverage, rule-type coverage, or difficulty profiles. Otherwise the richer valid snapshot remains authoritative for the session and for offline recovery.

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
