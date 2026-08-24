# Archive — history only

Everything in this folder is historical development record. **None of it
describes the current, live state of CertiTrack.** For that, see:

- `docs/CANONICAL_RELEASE.md` — current baseline
- `docs/CURRENT_SUPABASE_STATE_2026-08-24.md` — verified live database state
- `docs/NEXT_ACTION.md` — what to do next
- `docs/SECURITY_HARDENING.md` — current security status

## What's in here

- `PHASE*.md`, `*_CHANGES.md` — one file per development phase (2 through
  49), oldest to newest. Useful for understanding *why* something is built
  the way it is, or for tracing when a particular table/function/decision
  was introduced. Not useful as current instructions — later phases
  sometimes contradict earlier ones as the design evolved.
- `PRE_GITHUB_AUDIT_PHASE48_1.md` — a pre-publish audit snapshot from
  Phase 48.1.
- `EMAIL_ACTIVATION.md` — described a Resend-based email pipeline that was
  never actually the one deployed. See its own end-of-file note.
- `ORGANIZATION_ARCHITECTURE_PRE39.md` — the organization data model before
  the Phase 39 canonical consolidation.

Consolidated here 2026-08-24 (previously scattered between `docs/` root and
this folder, with some files duplicated in both places).

If a phase doc's content conflicts with something in the current docs
listed above, the current docs are correct — the phase doc reflects only
what was true or planned at that point in time.
