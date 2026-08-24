# Archived — 2026-08-24

`00_preflight_assertions.sql` and `00b_confirm_failed_run_rolled_back.sql`
assumed the live database still had the very old legacy schema (`companies`,
`suppliers`, `company_certificates`, etc.). As of 2026-08-24 those tables no
longer exist — the live project runs the canonical Phase 39 schema (see
`docs/CURRENT_SUPABASE_STATE_2026-08-24.md`). Running the old preflight
script today would fail immediately (`relation "public.companies" does not
exist`), which is correct-but-confusing: it's not a real problem, the
assumption is just outdated.

Kept here for history. If you ever need to preflight-check this database
again before a schema change, write a fresh one against the CURRENT schema
(see `supabase/production/03_validate_schema.sql` for the shape of a
read-only verification query) rather than reusing this file.
