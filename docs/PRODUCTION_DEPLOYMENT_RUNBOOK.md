# CertiTrack — Canonical Deployment Runbook (Phase 48.1)

## Source of truth

- Frontend: this repository.
- Canonical Supabase split setup: `supabase/current/01_schema.sql` through `07_validate.sql`.
- Clean-project one-shot setup: `supabase/FULL_SETUP.sql`.
- Current live database: already built phase-by-phase; do not re-run the clean setup on it.

## Existing live project

For the existing CertiTrack Supabase project, deployment is frontend-first:

1. Commit/push this canonical repository to GitHub.
2. Deploy the same commit to Netlify.
3. Confirm the configured Supabase URL and anon key point to the intended project.
4. Test authentication, organization profile, certificates, partner invitation/acceptance, certificate visibility and private PDF access.
5. Verify unrelated organizations cannot read each other's private data.
6. Verify password reset and logout/login flows.
7. Keep Platform Admin production actions read-only until the dedicated server-controlled cross-tenant backend is completed.

## Brand-new or recovery Supabase project

Only for an empty replacement/recovery project:

1. Read `supabase/current/README.md`.
2. Either run the ordered files in `supabase/current/` or run `supabase/FULL_SETUP.sql` once.
3. Run the canonical validation file (`supabase/current/07_validate.sql`) when using the split setup.
4. Confirm the `organizationcertificates` bucket is private.
5. Configure Auth redirect URLs and email confirmation settings before creating production users.
6. Perform two-organization isolation tests before go-live.

## Platform Admin

The schema contains `platform_admins` and `ct_is_platform_admin()`, but cross-tenant admin reads/writes are intentionally not enabled by the canonical RLS pack yet. The current frontend therefore treats production organization administration as read-only. Do not add broad `using (true)` policies to make it work quickly.

## Secrets

Never commit:

- service-role keys
- `.env` files
- Resend API keys
- cron secrets
- private API credentials

The public Supabase anon key may exist in frontend configuration; authorization must remain enforced by RLS and private storage policies.
