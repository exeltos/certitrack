# Phase 34 — Auth & Account Security

## Canonical authentication flow
1. User registers an Organization with legal name, email, Greek VAT number and a strong password.
2. Supabase Auth creates the auth user.
3. Phase33 database trigger atomically creates the Organization, owner membership and notification preferences.
4. Until `email_confirmed_at` is set, membership/organization remain `pending_verification`.
5. Confirmation activates both records.
6. Login uses **email + password**. VAT is the organization's unique business identifier, not an authentication secret.
7. Password recovery uses Supabase `resetPasswordForEmail`; the UI always returns a generic response to prevent account enumeration.
8. Reset page requires an authenticated recovery session and enforces the same password policy.

## Password policy target
- Minimum 12 characters
- At least one lowercase
- At least one uppercase
- At least one number
- At least one symbol
- Frontend validates this now.
- Phase deployment must configure the equivalent Supabase Auth password rules so server-side Auth remains authoritative.

## Production Auth settings to configure at deployment
Do **not** change these yet:
- Confirm email: ON
- Site URL: production CertiTrack URL
- Redirect allow-list:
  - production `/pages/auth/login.html`
  - production `/pages/auth/reset-password.html`
  - local development equivalents while testing
- Minimum password length: 12
- Required character classes: lower + upper + digit + symbol
- CAPTCHA/rate-limit review before public launch
- Custom SMTP before production email volume
- Email templates: Confirm signup, Reset password, Invite user

## Security decisions
- No public AFM→email lookup.
- No hard-coded admin email bypass.
- No custom Netlify reset-link generator.
- No service-role key in browser.
- Generic recovery response prevents revealing whether an email exists.
- Organization access is resolved through `organization_members`.
