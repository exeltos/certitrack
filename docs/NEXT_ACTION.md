# Next Action — CertiTrack Phase 48.1

This repository is the canonical CertiTrack frontend + Supabase source pack.

## For the current live Supabase project

Do **not** run `supabase/FULL_SETUP.sql` and do **not** rerun the files in `supabase/current/` just because they are present in this repository. The live database was already assembled phase-by-phase and is currently the active environment.

Your next safe action is application-level testing:

1. Upload this repository to GitHub.
2. Deploy the same repository to the existing Netlify site.
3. Test sign-in / registration only with the intended Supabase project configuration.
4. Create or use a test organization.
5. Verify certificates, partner relationships, private PDF access and logout/login behavior.
6. Keep Platform Admin in read-only mode until its server-controlled cross-tenant policies and write RPCs are implemented and tested as a separate backend phase.

## For a brand-new / recovery Supabase project only

Use the canonical setup documented in `supabase/current/README.md` or run `supabase/FULL_SETUP.sql` once on an empty project.

Never paste service-role keys, Resend API keys, cron secrets or `.env` values into frontend files or GitHub.

Phase 48.3 adds the collaboration email outbox pipeline and worker RPCs.
