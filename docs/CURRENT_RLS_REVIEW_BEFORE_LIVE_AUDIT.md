# Current RLS review — based on repository migrations only

**Updated:** reviewed against the canonical Phase 49 schema (`supabase/production/01_certitrack_production_schema.sql`), not the legacy pre-Phase-33 model. The findings below dated to the legacy `suppliers`/`company_suppliers` tables, which the canonical schema replaces with `organizations` / `organization_relationships`. That legacy review is kept in `docs/archive/` for history; it no longer describes the schema this repo is about to deploy.

This is still not a live Supabase snapshot. The definitive review must use `supabase/AUDIT_DATABASE_AND_RLS.sql` against the current project after the canonical schema is applied.

## Status of the previously flagged items

1. ~~`suppliers_insert_authenticated` uses `WITH CHECK (true)`~~ — table no longer exists in the canonical model. `organizations` insert/update is gated by `ct_has_org_role(...)`.
2. ~~`company_suppliers_update_members` lets either member change `company_id`~~ — `organization_relationships` has **no direct client INSERT/UPDATE/DELETE policy at all**; lifecycle changes go only through `security definer` RPC functions. This is a stronger design than what was flagged.
3. ~~Platform Admin has no explicit RLS policy~~ — resolved. `ct_is_platform_admin()` is checked explicitly in every table's policies, and `platform_admins` itself has a `select` policy scoped to `ct_is_platform_admin()`.
4. `audit_log` — confirmed: no authenticated insert policy in the canonical schema, select is gated to `ct_is_platform_admin()` or org owner/admin. Insert path must remain service-role/trigger only. **Still worth a live check** that no code path inserts into `audit_log` using the anon/authenticated client.
5. ~~Certificate UPDATE/DELETE rely on legacy `*_user_id`~~ — resolved. Canonical `certificates` policies check `ct_has_org_role(organization_id, ...)` consistently; there is intentionally **no client DELETE policy** (UI deletion is soft-delete via UPDATE), which is good practice.
6. Storage — confirmed private (`organizationcertificates` bucket, `public=false`), policies scoped by `ct_storage_org_id()` derived from the path, plus a partner-visibility branch for `visibility='partners'` certificates. Application code (`storageService.js`, `certificateStorage.js`) only calls `createSignedUrl()` — no `getPublicUrl()` usage found anywhere in the codebase.

## Still open

- The repository alone cannot prove the live schema state. Run `supabase/AUDIT_DATABASE_AND_RLS.sql` after deployment and compare policy names/definitions against this file.
- Confirm no leftover legacy storage policies remain on `storage.objects` after the canonical migration's `drop policy if exists` statements run (the migration drops known legacy names, but any policy created outside these migrations won't be caught).
- ~~Rotate the MailerSend token that was previously committed (tracked in `docs/SECURITY_HARDENING.md`).~~ **Done 2026-08-24** — MailerSend removed entirely; both API tokens revoked in the MailerSend dashboard.

## Next step

Run the read-only audit SQL and export/copy the result sets after deployment. Then diff against the policy list above before relying on this document again.
