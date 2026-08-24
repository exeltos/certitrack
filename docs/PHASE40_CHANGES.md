# CertiTrack Phase 40 — UI Core Polish

- Organization name is now shown in the shared authenticated header instead of the generic “Οργανισμός” label.
- Dashboard organization label uses the real organization display/legal name, never the email as fallback when a name exists.
- Settings notifications redesigned into compact shared subsections with reusable switch controls.
- Expiry warning days redesigned as compact selectable chips.
- Settings save actions improved and kept visible while scrolling.
- Certificate search now has one explicit icon; native browser search decorations are disabled.
- Certificate table grid is more fluid and no longer forces horizontal page scrolling on desktop.
- Certificate action rail remains fixed on the far right.
- Removed the duplicate standalone certificate empty-state bug.
- Certificate empty state is rendered only when the current filtered list is actually empty.
- Shared stylesheet cache version bumped to v40.
