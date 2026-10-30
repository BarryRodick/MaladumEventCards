# GitHub cleanup — 30 October 2026

- Owner: main Codex chat 01a18c3d-3671-7cd0-acee-5923fa887ea0 on local Windows; canonical target BarryRodick/MaladumEventCards, GitHub main.
- Authority: user requested cleanup of old content and explicitly included both tracker and repository.
- Baseline: d22669d641d4eac4ff6f0219e06c3d38019c8290. Existing local unrelated implementation changes were excluded; remote documentation changes are built against the exact current main tree.
- Tracker: 27 open issues inspected. Closed 24 legacy issues (79–98 and101–104), retaining body/history and disposition notes. Issues82,86,104 closed completed based on implementation evidence recorded in #110; the other21 closed not planned/superseded, not represented as fixed.
- Retained and clarified #99 regression coverage, #100 hands-on device/accessibility verification and #112 real hosted account/save and cutover verification. Historical bodies preserved under details.
- Repository: replaced stale front-page README with current URL, feedback routing and accurate source/hosting boundaries. Moved old README, cardActions.md and testCardActions.md into docs/legacy/. Updated redirect documentation with current state while retaining historical evidence. No runtime, assets, catalogs, tests, workflows, licenses or save paths removed.
- Branch inventory: only main; no stale branches to delete. No separate Projects board was changed.
- Verification: GitHub Issues enabled, repository public/unarchived; native issue mutation receipts checked; three retained open issues and all24 closed issues independently read back. Documentation moves preserve exact action-guide blobs and existing runtime tree. No application build is needed for documentation-only changes. Final tree comparison confirmed every non-Markdown blob unchanged; public Pages returned HTTP200 with the current destination and legacy bypass intact.
- Tooling: gh is unavailable on this host; connected GitHub tools used. Guarded fast-forward commit6e2c4c532d919a94a495778c693d6bf36d9b48db consolidates repository changes; this receipt records post-publication verification. Existing required CI/workflow triggers preserved.
- Complete: tracker and repository cleanup verified. Keep #99/#100/#112 open for their actual remaining checks. No background jobs or temporary servers started.
