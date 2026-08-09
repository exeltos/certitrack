# CertiTrack Phase 13 — Compliance + Home / Overview refinement

## Added
- Company Compliance workspace (`pages/company/compliance.html`).
- Requirement profile creation and assignment to suppliers.
- Compliance calculation from required certificate types, missing documents and expiry dates.
- Demo compliance dataset and filters.
- Company sidebar entry for Compliance.
- EL/EN phrases for the new workspace.

## Home redesign
- Split hero with a product UI preview built in HTML/CSS (not an image).
- Clear primary CTA to demo and login.
- Three-step value flow: certificates -> requirements -> compliance.
- Company and supplier demo entry points.
- Responsive and dark-mode-aware presentation.

## Company overview redesign
- Compliance summary banner with score.
- KPI strip.
- Attention list.
- Quick actions, including Compliance.
- Recent activity panel.

## Source separation
- HTML remains under `/pages` and `/index.html`.
- CSS remains under `/assets/styles`.
- JavaScript remains under `/src`.
- New Phase 13 UI styles: `/assets/styles/components/phase13.css`.

## Checks performed
- `node --check` on every JavaScript file: pass.
- `npm run build`: pass.
- Local HTTP smoke check: index, company dashboard, compliance, suppliers, company certificates, supplier certificates, supplier companies: HTTP 200.

## Live Supabase note
Static/runtime structure is verified locally. Full database behaviour (RLS, real certificate rows, real invitations and storage access) still needs an authenticated test against the target Supabase project before production release.
