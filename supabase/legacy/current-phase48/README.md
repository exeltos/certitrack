# CertiTrack Supabase — Current Canonical Setup

This folder is the canonical backend definition matching the Phase 47/48 frontend.

## Fresh project order
Run in Supabase SQL Editor, in this order:
1. `01_schema.sql`
2. `02_auth_helpers.sql`
3. `03_rls.sql`
4. `04_storage.sql`
5. `05_business_functions.sql`
6. `06_grants_reload.sql`
7. `07_validate.sql` (read-only verification)

`FULL_SETUP.sql` is the same setup concatenated into one file for a clean/new Supabase project.

## Storage path convention
`organization_id/certificate_id/filename.pdf`

## Main model
- `organizations`: all companies; no separate company/supplier tables.
- `organization_members`: users/roles.
- `organization_relationships`: company-to-company partner relationships.
- `certificates` + `certificate_files`: one certificate model with readable snapshot names and PDF versions.
- `relationship_requirements`: requirements from requester to partner.
- notifications/preferences/audit/email outbox/platform admins.

## Important
Do not run `FULL_SETUP.sql` over an unrelated populated project. It is designed for a clean CertiTrack Supabase project or a project already aligned with these objects.
