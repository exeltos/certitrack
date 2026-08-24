# CertiTrack Canonical Release

Current consolidated baseline: **Phase 49** (schema) + hardening phases 50-54 (2026-08-24)

This is the working repository baseline. Phases 2-48.4 are archived
history (`docs/archive/`) — useful for context, not current instructions.

## Current architecture summary

- **Schema**: `supabase/production/01_certitrack_production_schema.sql` —
  the single source of truth. Verified live 2026-08-24, see
  `docs/CURRENT_SUPABASE_STATE_2026-08-24.md`.
- **Frontend**: `organization/*` is the only user-facing flow (legacy
  `company/*`/`supplier/*` pages removed 2026-08-24).
- **Email**: `email_outbox` + Supabase `process-notifications` Edge
  Function + direct SMTP (MailerSend removed 2026-08-24, see
  `docs/operations/EMAIL_SETUP.md`).
- **Relationships**: request/accept/decline via
  `ct_create_relationship_invitation` / `ct_respond_relationship`; ending
  (whether cancelling a pending request or ending an active partnership)
  goes through `ct_end_relationship`, which sets `status='ended'` — nothing
  is hard-deleted.
- **Account closure**: `ct_request_organization_closure` /
  `ct_cancel_organization_closure` (reversible deactivation) and, for
  final GDPR-style erasure, `ct_finalize_erasure` +
  `netlify/functions/finalize_account_erasure.js` (irreversible).

Before production deployment, read `docs/NEXT_ACTION.md`.
