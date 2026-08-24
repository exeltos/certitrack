# Phase 7 — Core UX & Legacy Cleanup

## Completed
- Company home is now a real overview dashboard with KPI cards, attention list and quick actions.
- Company suppliers moved to a dedicated `/pages/company/suppliers.html` screen.
- Supplier company relationships moved to `/pages/supplier/companies.html`.
- Sidebar/page headers updated so every main navigation item maps to a real screen.
- Certificate screens normalized to a compact list-first visual language through the shared design system.
- Shared Phase 7 components added for KPI cards, filter bars, status badges, panels, company rows and responsive layouts.
- Legacy supplier/dashboard pages no longer drive the company home screen.
- Obsolete `src/pages/company/dashboard.js` and unused `src/features/suppliers/dashboard.js` removed.
- Supplier certificate page no longer depends visually on the embedded companies panel.
- Company supplier return links now go to the dedicated suppliers screen.

## Compatibility
- Supabase services, authentication flow and existing database schema were not changed.
- Existing stored status strings are retained where application logic depends on them, while the visible UI uses normalized status badges.
- Demo entry continues to use the existing demo-session mechanism.

## Verification
- `npm run build` passes.
- All JavaScript files pass `node --check`.
- Local HTTP smoke test returns 200 for company dashboard, suppliers, certificates, supplier companies and supplier certificates.
