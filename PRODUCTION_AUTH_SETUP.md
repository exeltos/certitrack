# CertiTrack Production Auth Configuration

Apply **after** the production schema has validated.

## Authentication model
- Email + password.
- VAT/ΑΦΜ identifies the Organization; it is not used as an authentication secret.
- Confirm Email: ON.
- Registration trigger creates Organization + owner membership as `pending_verification`.
- Email confirmation activates both.
- Password recovery uses Supabase Auth recovery links.

## Password policy
Configure in Supabase Auth:
- minimum length: 12
- uppercase required
- lowercase required
- number required
- symbol required

The frontend enforces the same rule, but Supabase Auth must remain authoritative.

## URLs
Production Site URL:
`https://www.certitrack.gr`

Allowed redirect URLs:
- `https://www.certitrack.gr/pages/auth/login.html`
- `https://www.certitrack.gr/pages/auth/reset-password.html`

Add localhost URLs only while testing locally.

## Email
Before public launch configure Custom SMTP.
The built-in Supabase sender is not a production mail service.

Templates in:
`supabase/email-templates/`

Configure:
- Confirm signup
- Reset password
- Invite user

## Security
- Never put service-role/secret keys in frontend code.
- Do not use `raw_user_meta_data` for authorization roles.
- Organization roles are stored in `organization_members` and enforced by RLS/RPC.
