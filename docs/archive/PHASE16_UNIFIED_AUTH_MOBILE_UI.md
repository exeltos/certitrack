# Phase 16 — Unified authentication, forms and mobile UI

- Removed the legacy pictogram from the shared shell. CertiTrack now uses a neutral wordmark-only brand treatment.
- Added one shared authentication design for sign in, company registration, supplier registration, password recovery and password reset.
- Removed Tailwind-driven auth page styling and consolidated these screens into `assets/styles/components/auth.css`.
- Added `phase16.css` as the final shared form/profile/mobile normalization layer.
- Reworked account settings fields into a responsive two-column desktop layout / one-column mobile layout.
- Added explicit labels, consistent focus/disabled states and mobile-friendly password controls.
- Restored explicit page module loading on auth screens so registration, sign-in, forgot-password and reset flows execute from their page controllers.
- Extended EL/EN translations for the new shared authentication copy.
