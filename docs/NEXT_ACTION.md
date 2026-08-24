# Next Action

**Status as of 2026-08-24: fully deployed, verified, and cleaned up.**

- Canonical schema (Phase 39 model) live and verified — see
  `docs/CURRENT_SUPABASE_STATE_2026-08-24.md`.
- All four Phase 50-53 hardening migrations applied (rate limiting, audit
  coverage, account erasure, notification idempotency).
- MailerSend fully removed from code, secrets, and the MailerSend account
  itself (both API tokens revoked).
- `process-notifications` Edge Function deployed with SMTP (Gmail),
  `Verify JWT with legacy secret` disabled, tested live with a 200 OK.
- `certitrack-daily-notifications` pg_cron job active and pointing at the
  correct function URL.
- The 4 stale/broken Edge Functions (`dynamic-api`,
  `notify_expiring_certificates`, `notify_subscription_expiry`,
  `send_certificate_email`) and the unused `RESEND_API_KEY` secret have
  been deleted. Only `process-notifications` remains.

## What's left

1. **Platform admin**: run `supabase/production/04_make_platform_admin.sql.template`
   (replace the placeholder UUID with your intended admin's `auth.users.id`
   after they've signed up once).
2. **Deploy the frontend**: push this repo to GitHub and deploy to Netlify,
   confirming `src/config/appConfig.js` points at this same Supabase project.
   Also set the Netlify environment variables for `send_email.js` /
   `send_registration_email.js`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
   `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` — same
   Gmail values used for the Edge Function, set separately (Netlify secrets
   and Supabase Edge Function secrets are two different places).
3. **Real end-to-end test**: register a real organization, add a
   certificate with an expiry date matching one of the default warning
   thresholds (90/60/30/15/7/0 days out), then wait for the 08:00 UTC cron
   run (or manually re-trigger `process-notifications` the way we tested
   today) and confirm an actual email arrives in your inbox.
4. Optionally set `SENTRY_DSN` (`docs/operations/MONITORING_SETUP.md`) and
   set up uptime monitoring before relying on this for real customers.
5. ~~The legacy `company/*` and `supplier/*` page flow is currently broken~~ **Done — removed entirely (2026-08-24).** Deleted: `pages/company/*`, `pages/supplier/*`, `pages/auth/company-register.html`, `pages/auth/supplier-register.html`, and their supporting code (`src/pages/company/`, `src/pages/supplier/`, `src/pages/shared/profile.js`, `src/pages/auth/companyRegister.js`, `src/pages/auth/supplierRegister.js`, `src/pages/auth/loginExtras.js`, `src/features/suppliers/`, `src/services/companyService.js`, `src/services/supplierService.js`, `src/services/complianceService.js`, `src/services/relationshipService.js`, `src/demo/realScreenDemo.js`). Confirmed nothing else referenced any of it before deleting. `organization/*` is now the only user-facing flow.
6. Rotate the `CRON_SECRET` again once convenient, since it appeared in
   this conversation's chat log during setup — not urgent, but good hygiene.
   Same SQL as before (`vault.update_secret(...)`) — remember to also
   update the `CRON_SECRET` Edge Function secret to match afterward.
