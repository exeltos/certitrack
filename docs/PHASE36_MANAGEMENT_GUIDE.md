# Phase 36 — Management Guide

## What you do now
Nothing in Supabase yet. Keep this ZIP as the Phase36 checkpoint.

## Do not do yet
- Do not run Phase33, Phase35 or Phase36 migrations.
- Do not alter RLS or relationship tables manually.
- Do not add service-role keys to browser code.
- Do not migrate legacy company/supplier relationships yet.

## Deployment checkpoint later
We will first inspect the real Supabase project read-only, take a backup/checkpoint, then apply the canonical migrations in order and test with two real test organizations.

## Acceptance tests
1. Org A searches registered Org B by VAT/email and sends an invitation.
2. Org B sees a pending request but cannot see shared certificates before acceptance.
3. Org B accepts; the relationship becomes active and shared current PDFs become readable.
4. Private certificates remain invisible.
5. Org B declines; no partner certificate access is granted.
6. Org A can cancel a pending invitation without deleting either organization.
7. Ending an active relationship immediately removes partner certificate/storage access.
8. Unregistered email creates a pending invitation but no active relationship/access.
9. Owner/admin receives in-app relationship notifications according to preferences.
10. Email sending uses the authenticated server function and never exposes service-role credentials.
