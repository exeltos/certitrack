# Phase 39 — Management Guide

## What you do now
Nothing in Supabase yet.

This is the final code/database checkpoint before controlled deployment.

## What was cleaned
The active application no longer queries:
- `companies`
- `suppliers`
- `company_certificates`
- `supplier_certificates`
- `company_suppliers`

Those objects may still exist in the current Supabase project, but only as migration sources.

## What happens next
The next phase is no longer another feature phase. It is **Supabase Deployment**.

Order:
1. Read-only preflight of the actual project.
2. Export/backup current schema and data.
3. Link Supabase CLI to the project.
4. Dry-run migrations 33 → 35 → 36 → 37 → 38 → 39.
5. Review migration output.
6. Apply database migrations.
7. Configure Auth from Phase34.
8. Deploy Edge Function `process-notifications`.
9. Add Edge Function secrets.
10. Configure scheduler/Vault.
11. Run one-time legacy Storage migration.
12. Verify counts and permissions.
13. End-to-end test with two organizations.
14. Only after verification, decide when legacy tables/buckets can be archived or removed.

## Do not do now
- Do not run any migration manually.
- Do not delete old tables.
- Do not delete old Storage buckets.
- Do not run `migrate-legacy-storage.mjs`.
- Do not add service-role keys to frontend files.
- Do not enable Cron.
