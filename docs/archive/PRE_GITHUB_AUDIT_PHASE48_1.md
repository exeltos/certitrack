# CertiTrack Phase 48.1 — Pre-GitHub Audit

Status: **READY FOR GITHUB / FRONTEND DEPLOYMENT** after the checks in this repository.

## Changes made

- Removed stale references to the deleted `supabase/production/` pack.
- Replaced `NEXT_ACTION.md` with instructions that distinguish the existing live database from clean-project recovery setup.
- Rebuilt the deployment runbook around `supabase/current/` and `supabase/FULL_SETUP.sql`.
- Updated static asset cache query versions from `v=46` to `v=48`.
- Removed the frontend call to the nonexistent `ct_platform_set_organization_state` RPC.
- Made the Platform Admin organization screen explicitly read-only until the server-controlled admin backend is implemented.
- Performed non-functional CSS hygiene only; no visual redesign was introduced.
- Re-generated checksums for the canonical Supabase source pack.

## Important constraint

Do not run `supabase/FULL_SETUP.sql` against the current live database. It is a clean-project/restore source of truth.

## Platform Admin

Platform Admin is not considered production-complete for cross-tenant actions. This is intentional. Do not weaken RLS to enable it. Implement and test dedicated admin policies/RPCs in a later backend phase.
