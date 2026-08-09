# Phase 9 - Stabilization & UI Unification

Phase 9 removes the remaining mixed certificate/profile/supplier-detail visual layer and fixes certificate workflow defects.

## Key changes
- Company and supplier certificate screens rebuilt on one list-first CertiTrack UI system.
- Removed Tailwind CDN and legacy gradient/card markup from certificate, profile and supplier-detail core screens.
- Certificate preview now uses a signed URL iframe with a new-tab fallback.
- Demo mode contains real sample PDF files and working Preview actions.
- Demo certificate edit controls are interactive without writing to Supabase.
- Certificate edit correctly restores existing type, including custom `Άλλο` values.
- Supplier certificate edit correctly persists `is_private`.
- Company certificate search restored after removal of the legacy inline handler.
- Export mapping updated for the new certificate rows.
- Profile password visibility controls now have real JavaScript handlers (the old inline call referenced a missing function).
- Profile and company supplier pages rebuilt with canonical fields/buttons/cards.
- Removed duplicate component button/card/form/shell imports from `app.css`; canonical CSS is now the visual source of truth.
