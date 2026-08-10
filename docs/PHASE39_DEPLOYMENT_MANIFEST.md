# Phase 39 — Deployment Manifest

Canonical migration order:

1. `20260810133000_phase33_backend_foundation.sql`
2. `20260810150000_phase35_certificate_storage_security.sql`
3. `20260810161000_phase36_relationships_invitations_partner_access.sql`
4. `20260810173000_phase37_notifications_expiry_email.sql`
5. `20260810184500_phase38_audit_account_lifecycle.sql`
6. `20260810193000_phase39_legacy_bridge_finalization.sql`

After database migration:
- Auth configuration from Phase34
- Edge Function `process-notifications`
- Edge Function secrets
- Cron/Vault schedule
- one-time `scripts/migrate-legacy-storage.mjs`

## Legacy data bridge
Phase39 maps:
- companies → organizations
- suppliers → organizations
- both user accounts → organization_members
- company/supplier certificates → certificates
- company_suppliers → organization_relationships

Same VAT number merges into one neutral Organization.

## Legacy files
Legacy PDFs are **not destroyed or moved by SQL**.
The migration records their old bucket/reference.
The one-time Node migration copies PDFs into the canonical private bucket and registers the current file version.

Old buckets remain untouched until verification.
