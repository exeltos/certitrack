# Current Supabase State — Verified 2026-08-24

Project Ref: `klutmusrabsizqjnzwpu`

**This supersedes `CURRENT_SUPABASE_STATE_2026-08-10.md` (now in `docs/archive/`
if you want the history).** The 2026-08-10 snapshot assumed legacy
`companies`/`suppliers` tables that, as of this verification, don't exist —
the live project's schema had drifted from what the repo's canonical file
describes (it was built from earlier, pre-consolidation phase migrations,
including an older audit-trigger design that broke on cascading deletes).

## What happened on 2026-08-24

1. Found 2 test auth users + matching test organizations/certificates —
   confirmed disposable, deleted.
2. Found the live schema had an older-generation audit trigger
   (`ct_audit_certificate` calling a 10-argument `ct_write_audit`) that
   doesn't exist in the current canonical schema, and caused a foreign-key
   error when deleting an organization with certificates attached.
3. Fixed a latent bug in `01_certitrack_production_schema.sql`: its
   `certificate_types` table definition assumed pre-existing legacy columns
   (`name`, `requires_expiry`) that only existed by accident of deployment
   history, not by design. Fixed so the script now works correctly against a
   genuinely empty database too (important for `docs/operations/STAGING_SETUP.md`).
4. Fully reset: `drop schema public cascade` / `create schema public` +
   standard Supabase grants, then ran the corrected
   `01_certitrack_production_schema.sql`, `02_enable_notification_extensions.sql`,
   `03_validate_schema.sql` fresh.
5. Applied all four Phase 50-53 hardening migrations (rate limiting, audit
   coverage, account erasure, notification idempotency) on top.

## Verified state after this process

- `organization_model_version()` = `39`
- 15 canonical tables present, RLS enabled on all of them, 23 policies
- Storage bucket `organizationcertificates`: private (`public: false`)
- `certificate_types`: 8 rows (default set)
- `pg_cron` 1.6, `pg_net` 0.14.0 extensions enabled
- `rate_limit_events`, `sent_notification_log` tables present;
  `ct_check_rate_limit`, `ct_claim_notification`, `ct_finalize_erasure`
  functions present; 5 audit triggers attached
  (`certificate_files`, `certificates`, `organization_members`,
  `organization_relationships`, `organizations`)
- All row counts (`auth.users`, `organizations`, `certificates`, etc.): 0 —
  clean slate, ready for real use

## Not yet done (see docs/NEXT_ACTION.md)

- `04_make_platform_admin.sql.template` — no platform admin configured yet.
- `05_schedule_notifications.sql.template` — cron scheduling for expiry
  notifications not yet configured.
- Netlify environment variables (`SMTP_PASSWORD`, `CRON_SECRET`,
  `SENTRY_DSN`, etc.) not yet confirmed set.
- End-to-end signup/login/certificate-upload test with a real (non-demo)
  account not yet performed against this fresh schema.


## Edge Functions cleanup (later same day)

Found 5 Edge Functions total; only `process-notifications` is real/current:

- `dynamic-api` — default Supabase "hello world" template, never used. **Deleted.**
- `notify_expiring_certificates` — pre-canonical version of the notifier.
  Queried legacy tables (`suppliers`, `companies`, etc.) that no longer
  exist. **Had a live SMTP provider API key hardcoded in the source
  (`mlsn.9e5839...`) — revoked in the SMTP provider dashboard.** **Deleted.**
- `notify_subscription_expiry` — same legacy-table problem, plus relied on
  a "subscription expiry" concept that doesn't exist in the canonical
  schema (see the disabled Netlify stub for the same reasoning). **Deleted.**
- `send_certificate_email` — written in Netlify Functions syntax
  (`export async function handler(event)`), not valid Deno/Edge Function
  syntax — never actually worked regardless of schema issues. Used a third
  email provider (SMTP provider) via `SMTP provider_API_KEY`. **Deleted, along with the
  `SMTP provider_API_KEY` secret.**

Also revoked the second SMTP provider API token found in the SMTP provider
dashboard (`mlsn.628266...`, "CertiTrack Supabase Notifications") — was the
value previously stored as the `SMTP_PASSWORD` Supabase secret, now
unused since the switch to SMTP.

Remaining Edge Function: `process-notifications` only. Remaining secrets:
`CRON_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
`SMTP_PASSWORD`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `APP_URL`.
