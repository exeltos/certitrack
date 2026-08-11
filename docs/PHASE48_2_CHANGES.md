# Phase 48.2 — Demo/Core Alignment Guardrails

- Confirmed Demo and Production use the canonical shared stylesheet/design system.
- Added explicit application-mode helper (`src/config/appMode.js`).
- Added Demo architecture contract and regression checklist.
- Kept Demo data isolated from Supabase writes.
- Did NOT force production pages and Demo into one route tree without regression tests.
- Demo remains clearly identified as Demo.
- No Supabase schema/RLS changes.
