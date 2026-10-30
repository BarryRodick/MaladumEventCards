# Event Deck homepage redirect

## Current state — 30 October 2026

GitHub Pages index.html redirects visitors to https://eventdeck.rodick.me/ through JavaScript and a noscript refresh. That target was updated in commit d22669d641d4eac4ff6f0219e06c3d38019c8290 and verified by HTTP readback.

The legacy service worker may still direct cached visitors to the previous Sites address, which remains available. Returning controlled-client verification is retained in [#112](https://github.com/BarryRodick/MaladumEventCards/issues/112); this cleanup does not claim it complete or change worker behavior.

[Legacy access](https://barryrodick.github.io/MaladumEventCards/?legacy=1) is retained for local decks and campaigns. No redirect reads, transfers or clears saved data. Browser saves remain specific to their origin.

This repository contains the legacy runtime and redirect, not the current hosted Sites source. The README explains that boundary.

## Historical preparation and rollback evidence

The September 2026 preparation targeted the previous Sites address. Its local validation covered legacy browser journeys, service-worker update and forward rollback simulations; those checks are not live verification of the current custom-domain cutover.

Historical baseline: 13f2a554f4416abbad736f81225e1aab4a710d84. Any rollback must be separately scoped and preserve browser data; worker versions must advance rather than reverting to2.16.2. No rollback or worker modification is part of the October cleanup.
