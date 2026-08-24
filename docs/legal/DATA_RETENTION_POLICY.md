# CertiTrack — Data Retention & Deletion Policy (DRAFT)

**Status: draft for legal review — do not publish or rely on this as a compliance
document until a lawyer familiar with Greek/EU data protection law has reviewed it.**

This document describes what CertiTrack stores, for how long, and how deletion works.
It exists so the answer to "what happens to our data if we delete our account" is
written down once, instead of re-derived from the schema every time someone asks.

## What is stored

| Data | Where | Notes |
|---|---|---|
| Organization profile (name, VAT/AFM, contact info, address) | `organizations` table | |
| User accounts | Supabase Auth (`auth.users`) + `organization_members` | Email, hashed password, role |
| Certificates (metadata) | `certificates` table | Title, dates, status, visibility |
| Certificate files (PDFs) | Private storage bucket `organizationcertificates` | Signed-URL access only |
| Partner relationships | `organization_relationships`, `relationship_invitations` | |
| Notifications | `notifications`, `notification_preferences` | |
| Audit trail | `audit_log` | See retention note below — audit rows are kept longer than other data for accountability |
| Outbound email queue | `email_outbox` | Transient — cleared after delivery |

## Retention periods (proposed — confirm against your actual legal obligations)

- **Active account data**: retained for as long as the organization's account is active.
- **Certificate records**: retained for the life of the account; soft-deleted (not
  hard-deleted) on user action, per the current schema's `deleted_at` column, so
  audit history stays intact.
- **Audit log**: proposed minimum **24 months** after the underlying event, to
  support dispute resolution and security investigation. Confirm this against
  any sector-specific requirement your customers have (e.g. certain compliance
  certificates may carry their own record-keeping rules).
- **Account deletion**: on request, personal data tied to a user should be
  deleted or anonymized within **30 days**, except where the audit log
  retention period above requires keeping a non-personal record of *that an
  action occurred* (see `docs/SECURITY_HARDENING.md` item 5 — deletion should
  become a privileged server-side function, not a client-side delete).
- **Backups**: see `docs/operations/BACKUP_DR_POLICY.md`. A deleted record can
  persist in backups for the backup retention window even after being deleted
  from the live database; this should be disclosed to users.

## Right to erasure / data portability

**Partially implemented.**

- ✅ **Account closure** (deactivation, reversible by a platform admin):
  `ct_request_organization_closure()` / `ct_platform_set_organization_state()`.
  Suspends members, ends partner relationships, keeps all data for the
  retention period above.
- ✅ **Final erasure** (irreversible — deletes certificate files from
  storage, deletes Auth users with no other org membership, anonymizes the
  organization row): `netlify/functions/finalize_account_erasure.js` +
  `ct_finalize_erasure()`. Requires the organization to already be
  `closed`, and requires platform-admin confirmation
  (`{ "confirm": "ERASE" }`) — this is intentionally not self-service from
  the UI yet, since erasure is irreversible and should involve a human
  checking the retention/legal-hold requirements above first.
- ❌ **Not yet built**: a user-facing "export my data" download, and a
  self-service "delete my account" button (as opposed to the current
  request → admin-reviewed → admin-triggered erasure flow).

## Sub-processors

Data currently flows through:
- **Supabase** (database, auth, storage) — confirm hosting region and DPA.
- **Your SMTP provider** (transactional email — see `docs/operations/EMAIL_SETUP.md`; MailerSend was removed 2026-08-24) — confirm DPA and data region for whichever provider you configure.
- **Netlify** (function hosting) — confirm DPA and data region.

A public sub-processor list is typically expected by B2B customers doing their
own compliance review of CertiTrack as a vendor.
