# Eventdeck homepage redirect

Prepared at Barry's request on 8 September 2026, from GitHub main `13f2a554f4416abbad736f81225e1aab4a710d84`. This branch contains only the old Pages redirect, not the separate Sites application.

The homepage and index.html redirect to https://eventdeck.barryrodick.chatgpt.site/. Old queries and fragments are discarded. JavaScript-disabled visitors use a meta refresh. The old service worker also redirects homepage navigation after its 2.16.3 update, so a cached homepage cannot indefinitely mask the move.

`https://barryrodick.github.io/MaladumEventCards/?legacy=1` retains access to existing local decks and campaigns. Other legacy HTML pages are unchanged. The redirect never reads, transfers or clears local storage. Existing saves do not move to the new origin.

Verification: unit tests, generated-version build, 142-card validation, six legacy browser/accessibility journeys and four redirect journeys. The service-worker journey starts on the original main worker, installs 2.16.3, reopens the page, checks the redirect and retained storage, then repeats with a forward 2.16.4 rollback. An already-open offline tab cannot receive an update until it reconnects; live returning-visitor checks remain necessary after publication.

GitHub Pages publishes main from the repository root. Publishing this candidate therefore requires pushing the review branch, merging the reviewed change and waiting for Pages to build. No push or merge is implied by the local preparation record. The new automatic redirect supersedes the earlier link-only proposal; no Sites runtime or database deployment is involved.

Rollback: restore index.html and service-worker.js from baseline `13f2a554f4416abbad736f81225e1aab4a710d84`, set version.json to 2.16.4 with the action date, run npm run build to synchronise the package and worker versions, rerun checks, and publish only with rollback approval. Do not revert to worker version 2.16.2. Retain all local saves.
