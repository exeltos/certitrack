# CertiTrack — Phase 1 Core Hardening

Applied in this package:

- Removed the committed `images/access_token.txt` credential file. The previous token must be revoked/rotated outside the codebase.
- Removed password logging and authentication debug output from the admin screen.
- Admin password re-authentication now uses the currently authenticated user's email rather than a hard-coded address.
- Admin access prefers `app_metadata.app_role = admin`, with temporary legacy email compatibility.
- Repaired the missing certificate-email endpoint call by routing it through the existing `send_email` function.
- Added the two Netlify scheduled functions referenced by `netlify.toml`.
- Removed unused dependencies and obsolete files.
- Added basic HTML escaping for server-generated email content.
- Protected the generic email function with Supabase session-token validation to prevent unauthenticated relay abuse.

Still required before production security sign-off:

1. Rotate/revoke the previously committed MailerSend token.
2. Verify Supabase RLS policies for every table and Storage bucket.
3. Make certificate Storage buckets private and migrate public URLs to signed URLs.
4. Replace the legacy admin-email fallback with server-controlled roles after role migration.
5. Move account deletion into a privileged server-side function that also removes the Supabase Auth user and related files.
6. Add persistent notification/audit idempotency before relying on scheduled reminders at scale.
