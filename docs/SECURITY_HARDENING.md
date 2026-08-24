# CertiTrack — Phase 1 Core Hardening

Applied in this package:

- Removed the committed `images/access_token.txt` credential file. The previous token must be revoked/rotated outside the codebase.
- Removed password logging and authentication debug output from the admin screen.
- Admin password re-authentication now uses the currently authenticated user's email rather than a hard-coded address.
- Admin access prefers `app_metadata.app_role = admin`, with temporary legacy email compatibility.
- Repaired the missing certificate-email endpoint call by routing it through the existing `send_email` function.
- Added the two Netlify scheduled functions referenced by `netlify.toml`.
- Removed unused dependencies and obsolete files.
- Added basic HTML escaping for server-generated email content.
- Protected the generic email function with Supabase session-token validation to prevent unauthenticated relay abuse.

Still required before production security sign-off:

1. ~~Rotate/revoke the previously committed MailerSend token.~~ **MailerSend itself has been removed from the codebase (2026-08-24) — see `docs/operations/EMAIL_SETUP.md`, all app email now goes through direct SMTP.** The old committed token should still be revoked in the MailerSend dashboard, since it was exposed in git history regardless of whether the app still uses it.
2. ~~Verify Supabase RLS policies for every table and Storage bucket.~~ Reviewed against the canonical Phase 49 schema — see `docs/CURRENT_RLS_REVIEW_BEFORE_LIVE_AUDIT.md`. Still needs a **live** audit run (`supabase/AUDIT_DATABASE_AND_RLS.sql`) after deployment, since the repo can't prove the live state on its own.
3. ~~Make certificate Storage buckets private and migrate public URLs to signed URLs.~~ **Done** in the canonical schema/codebase: the `organizationcertificates` bucket is created with `public=false`, and `storageService.js` / `certificateStorage.js` only call `createSignedUrl()` — no `getPublicUrl()` usage found anywhere.
4. ~~Replace the legacy admin-email fallback with server-controlled roles after role migration.~~ **Done** — `requirePlatformAdmin()` in `src/pages/admin/adminCommon.js` used to check `user.app_metadata.role === 'admin'` (a JWT claim, independent of the database). It now calls `ct_is_platform_admin()` via RPC, the same source of truth every RLS policy already uses.
5. ~~Move account deletion into a privileged server-side function that also removes the Supabase Auth user and related files.~~ **Done** — `netlify/functions/finalize_account_erasure.js` (+ `ct_finalize_erasure()` in `supabase/migrations/20260824_phase52_account_erasure.sql`). Deletes storage files, deletes Auth users with no other org membership, anonymizes the organization row. Requires the org to already be `closed` and requires explicit confirmation. **The SQL side (`ct_finalize_erasure`, the `erasure_completed_at`/`erasure_completed_by` columns) is verified live as of 2026-08-24 — see docs/CURRENT_SUPABASE_STATE_2026-08-24.md. The Netlify function itself has not yet been run end-to-end against a real closed organization — test that before relying on it.**
6. ~~Add persistent notification/audit idempotency before relying on scheduled reminders at scale.~~ **Done** — `supabase/migrations/20260824_phase53_notification_idempotency.sql` adds an atomic claim function (`ct_claim_notification`); both scheduled functions now claim a per-certificate/per-user, per-threshold, per-cycle dedupe key before sending, so a retried or duplicated cron invocation can't send the same reminder twice. **The SQL side is verified live as of 2026-08-24. The scheduled functions themselves have not yet fired against real certificate data — the legacy tables they query (`companies`, `supplier_certificates`, etc.) no longer exist in this schema, so these two functions need to be rewritten against the canonical `organizations`/`certificates` tables before they'll work at all — see the note added to NEXT_ACTION.md.**

## Repository hygiene (added after Phase 49 review)

7. ~~Root-level directory contained ~60 stale duplicate `.js`/`.html`/`.css` files with broken relative paths (leftover from a flattened export), living alongside the real files under `src/`/`pages/`.~~ **Done** — archived to `_ARCHIVE_unused_root_duplicates/`. Delete that folder once you've confirmed nothing depended on it, and don't unzip future exports flat into the repo root again.
