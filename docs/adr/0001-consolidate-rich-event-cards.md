# ADR 0001: Consolidate Rich Event Cards into the Main Project

- Status: Accepted
- Date: 2026-08-14

## Context

`BarryRodick/maladum-rich-event-cards` was split from the rich-card work that ended at main-project commit `0a68b63`. Both repositories then changed independently. The main project developed the newer live-deck and campaign architecture, while the split project completed the structured-card fidelity review and retained two useful deck-behaviour fixes.

The split repository has unrelated Git history, so merging its root would duplicate the application and obscure the main project's history.

## Decision

`BarryRodick/MaladumEventCards` is the sole canonical project.

The split repository is reconciled by porting reviewed outcomes, not by merging unrelated histories:

| Split-project work | Disposition |
| --- | --- |
| `7f68faf` rich-card fidelity review | Port the final seven card files, extraction report, icon registry, seven SVG icons, accent-insensitive search, fidelity tests, and icon sizing constraints. |
| `9a10f75` Sudden Rot verification | Port the verified food list and its regression coverage. |
| `d2ff015` architecture refactor | Keep main's later architecture. Port only the `shuffleTopN` next-card fix and fixed five-card Corrupter replacement behaviour. |
| `44286bf` Dungeons achievement wiring | Do not copy. Main's campaign tracker already captures every `.checkbox`, including achievements. |
| `3fdc44b` cache version bump | Superseded by main's version and generated service-worker manifest. |
| `68ea6f5` printed card text order | Remove the synthetic type/game row from rich-card rendering and retain the printed title-to-section order. |
| Local-only `3cd0de3` agent setup | Do not port as product code. Main already has its own local agent guidance and issue-tracker conventions. |

Main's defensive catalog normalization, saved-state hydration, live-deck session/view modules, campaign accessibility support, package identity, dependency versions, and service-worker generation remain authoritative.

## Branch Disposition

At the time of this decision, the main GitHub repository had 12 non-main remote branches. `codex/setup-cleanup-2026-04-29` was already merged. The other 11 each had a single branch-only tip; semantic review found only the old `5c38bdc` `shuffleTopN` behavior missing, and that outcome is ported here into the current modular live-deck implementation. The other ten tips are functionally superseded, empty, or incomplete and unwired.

The split repository's remaining `codex/verify-sudden-rot` remote branch is already contained in its `main`. Remote branch deletion remains a separate, approval-gated GitHub maintenance action.

## Consequences

- New code, card corrections, issues, and releases belong only in `MaladumEventCards`.
- Treat the split repository as read-only until its GitHub repository is separately archived; archiving or deletion is an external administrative action, not part of this code merge.
- Version 2.16.1 is the first consolidated catalog version.
- The current catalog has 142 verified rich-card records across seven game files.
- Future extractor runs must preserve human-managed or verified records unless an explicit force-regeneration review is intended.
