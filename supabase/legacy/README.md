# Legacy / archived Supabase SQL

**None of this describes the live schema.** It's kept for history only.
The single source of truth is `supabase/production/` — see
`docs/CANONICAL_RELEASE.md` and `docs/CURRENT_SUPABASE_STATE_2026-08-24.md`.

Consolidated here on 2026-08-24 (previously scattered across
`supabase/current/`, `supabase/deployment/`, `supabase/preflight/`,
`supabase/tests/`, `supabase/FULL_SETUP.sql`, `supabase/PHASE3C_VERIFY.sql`,
and `supabase/archive/`) specifically to stop the "which file is real"
confusion that caused real problems during the 2026-08-24 deployment (the
live database had drifted to an earlier phase's schema — see
`docs/CURRENT_SUPABASE_STATE_2026-08-24.md` for the full story).

## What's in here

| Path | What it was |
|---|---|
| `current-phase48/` | An earlier "canonical" split-file setup (Phase 47/48). Superseded by `production/01_certitrack_production_schema.sql` (Phase 49). |
| `FULL_SETUP-phase48.sql` | Single-file version of the above. Same status: superseded. |
| `deployment-phase37/` | Phase 37 draft of the notification-scheduling template. Superseded by `production/05_schedule_notifications.sql.template`. |
| `preflight-phase33/` | Phase 33 read-only preflight check. Superseded by the verification approach in `production/03_validate_schema.sql`. |
| `tests-phase33-37/` | Phase 33/37-specific read-only test queries. |
| `PHASE3C_VERIFY.sql` | References legacy bucket names (`suppliercertificates`, `companycertificates`) that no longer exist. |
| `00_preflight_assertions.sql`, `00b_confirm_failed_run_rolled_back.sql` | Assumed the old `companies`/`suppliers` tables still existed. They don't (confirmed 2026-08-24). |
| `20260810193000_phase39_legacy_bridge_finalization_DO_NOT_RUN.sql` | Exactly what the name says. |
| `incremental_preproduction/`, `phase28_organization_network.sql`, `phase31_certificate_metadata.sql` | Earlier incremental migration history. |

**Do not run any of this against the live database.** If you need to
preflight-check the live database before a future schema change, write a
fresh read-only query against the CURRENT schema — see
`supabase/production/03_validate_schema.sql` for the shape of one — rather
than reusing anything here.
