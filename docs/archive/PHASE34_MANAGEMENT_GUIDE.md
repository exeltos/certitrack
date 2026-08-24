# Phase 34 — Management Guide

## What changed
Auth frontend is aligned with the Phase33 canonical Organization schema:
- email/password login
- email verification-ready signup
- 12-character password policy
- official Supabase password recovery
- recovery-session reset page
- organization membership-aware guard
- removal of the legacy public AFM/email recovery lookup and hard-coded admin login path

## What you do now
**Nothing in Supabase yet.**
Keep this ZIP as the Phase34 checkpoint.

## Do NOT do yet
- Do not run Phase33 migration.
- Do not change Confirm Email.
- Do not edit Supabase Site URL/Redirect URLs.
- Do not change password policy in the Dashboard.
- Do not add SMTP credentials.
- Do not delete legacy tables.
- Do not put service-role/PAT secrets in frontend files.

## Why
The current live database is still legacy. Phase34 code targets the canonical model but retains transitional compatibility. We will first inspect the real Supabase project and then deploy schema + Auth configuration in a controlled sequence.

## Next deployment checkpoint
Before any write:
1. Run Phase33 read-only preflight.
2. Capture current Auth/URL/email configuration.
3. Back up schema/data.
4. Link Supabase CLI.
5. Dry-run canonical migration.
6. Only after review: deploy migration and configure Auth.

## Acceptance tests after deployment (later)
- Register a new organization.
- Verify no normal app access before email confirmation.
- Confirm email and sign in.
- Ensure organization + owner membership were created once.
- Test wrong password.
- Test forgot-password with existing and non-existing email; UI response must be indistinguishable.
- Open reset link and set a compliant password.
- Confirm old password fails and new password succeeds.
- Confirm an authenticated user cannot access another organization.
