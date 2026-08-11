# Phase 48.3 — Collaboration Email Pipeline

Fixed the missing backend path between collaboration requests and transactional email.

## Added
- Collaboration request now enqueues `relationship_invite` in `email_outbox`.
- Accept/reject now enqueues `relationship_accepted` / `relationship_declined`.
- Added `ct_claim_email_batch` and `ct_complete_email` worker RPCs.
- Updated `process-notifications` so missing expiry-generation RPC does not block relationship email delivery.
- Added non-destructive migration for the existing Phase 48 database.

## Not changed
- No RLS relaxation.
- No frontend secret.
- No MailerSend token committed.
- No database reset required.

## Live activation requirement
The migration must be executed on the live Supabase database, and the `process-notifications` Edge Function must be deployed with server-side secrets (`MAILERSEND_TOKEN`, `EMAIL_FROM`, `APP_URL`, `CRON_SECRET`). The worker must then be invoked by a secure scheduled/server-side call.
