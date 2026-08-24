# Backup & Disaster Recovery Policy

## Current state (verify this against your actual Supabase plan)

Supabase provides automatic daily backups on paid plans, with retention
depending on plan tier (commonly 7 days on Pro, longer on higher tiers, and
point-in-time recovery only on add-on/higher plans). **Confirm your current
plan's actual backup retention and PITR availability in the Supabase
dashboard (Project Settings → Database → Backups) — do not assume.**

Storage bucket contents (certificate PDFs) are covered by Supabase Storage's
own durability, but are a separate concern from database backups: a database
restore does not automatically undo an accidental file deletion in Storage,
and vice versa.

## Target policy (adjust to match what your Supabase plan actually offers)

| Item | Target |
|---|---|
| Database backup frequency | Daily, automatic |
| Database backup retention | 30 days minimum for a production compliance tool |
| Point-in-time recovery | Enabled if plan allows — needed to recover from a bad migration or accidental bulk delete without losing a full day of data |
| Storage bucket (certificate files) | Confirm Supabase Storage redundancy; consider a periodic export to a second location for anything customers would consider irreplaceable |
| Backup restore testing | At least twice a year, restore a backup to a scratch project and verify the app boots against it |

## Recovery Point Objective / Recovery Time Objective

Not yet formally set. Suggested starting point for a B2B compliance tool:

- **RPO (max acceptable data loss)**: 24 hours, tightening to whatever your
  actual backup frequency supports once confirmed.
- **RTO (max acceptable downtime)**: define based on customer expectations —
  this is a business decision, not a technical one. Whatever you commit to
  publicly (see `docs/operations/SLA.md`) must be something you've actually
  tested you can hit.

## Runbook (fill in once tested)

1. Identify the incident and confirm scope (single table? whole project?
   storage only?).
2. [Steps to restore from Supabase dashboard / CLI]
3. [Steps to verify data integrity post-restore — e.g. row counts, spot
   check recent certificates against known-good state]
4. [Steps to communicate the incident and any data loss window to affected
   customers]

## Migration safety net

Separately from backups: this repo already has good discipline around
`NEXT_ACTION.md` / preflight checks before running schema changes. Keep that
practice — most "disasters" for a project at this stage are more likely to
be a bad migration than an infrastructure failure, and a tested rollback
plan (see `PHASE39_ROLLBACK_PLAN.md` as a precedent) is cheaper than relying
on full DB restores for that class of problem.
