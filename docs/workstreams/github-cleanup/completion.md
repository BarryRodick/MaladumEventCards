# GitHub cleanup — 30 October 2026

- Owner: main Codex chat 01a18c3d-3671-7cd0-acee-5923fa887ea0 on local Windows; canonical target BarryRodick/MaladumEventCards, GitHub main.
- Authority: user requested cleanup of old content and explicitly included both tracker and repository.
- Baseline: d22669d641d4eac4ff6f0219e06c3d38019c8290. Existing local unrelated implementation changes were excluded; remote documentation changes are built against the exact current main tree.
- Tracker: 27 open issues inspected. Closed 24 legacy issues (79–98 and101–104), retaining body/history and disposition notes. Issues82,86,104 closed completed based on implementation evidence recorded in #110; the other21 closed not planned/superseded, not represented as fixed.
- Retained and clarified #99 regression coverage, #100 hands-on device/accessibility verification and #112 real hosted account/save and cutover verification. Historical bodies preserved under details.
- Repository: replaced stale front-page README with current URL, feedback routing and accurate source/hosting boundaries. Moved old README, cardActions.md and testCardActions.md into docs/legacy/. Updated redirect documentation with current state while retaining historical evidence. No runtime, assets, catalogs, tests, workflows, licenses or save paths removed.
- Branch inventory: only main; no stale branches to delete. No separate Projects board was changed.
- Verification: GitHub Issues enabled, repository public/unarchived; native issue mutation receipts checked; three retained issues need readback. Documentation moves preserve exact action-guide blobs and existing runtime tree. No application build is needed for documentation-only changes. Final branch/readback checks pending.
- Tooling: gh is unavailable on this host; connected GitHub tools used. One guarded fast-forward commit consolidates repository changes. Existing required CI/workflow triggers preserved.
- Next action: verify resulting main tree, issue states and public redirect; record final receipt locally. No background jobs or temporary servers started.
