# Email Setup (SMTP)

CertiTrack sends email through two independent paths — both need SMTP
configured, but separately:

## 1. Supabase Auth emails (signup confirmation, password reset, invites)

Configure in the Supabase Dashboard: **Project Settings → Auth → SMTP Settings**.
This covers `supabase.auth.resetPasswordForEmail()` and
`supabase.auth.admin.inviteUserByEmail()`, already used by
`reset_password_link.js` and `send_signup_invite.js` — no code changes
needed there, Supabase handles delivery itself once SMTP is configured.

## 2. App-level emails (certificate expiry reminders, registration confirmation)

Supabase's Auth SMTP config is **not** reachable from outside Supabase's own
auth flows — there's no API to send arbitrary content through it. App-level
emails are sent directly via `netlify/functions/_lib/mailer.js`
(nodemailer), using the same or a different SMTP account, configured as
separate Netlify environment variables.

Set these in Netlify (**Site settings → Environment variables**):

```
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false          (true if using port 465)
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_FROM_EMAIL=noreply@certitrack.gr
SMTP_FROM_NAME=CertiTrack
```

If you want one mail server for everything, use the exact same host/port/
user/password here as you entered in the Supabase Auth SMTP settings above.

### Functions that use this

- `send_email.js` — certificate/notification emails triggered from the app
- `send_registration_email.js` — registration confirmation

The scheduled certificate-expiry reminder pipeline is **not** a Netlify
function — it's `supabase/functions/process-notifications` (a Supabase Edge
Function), triggered by the `certitrack-daily-notifications` pg_cron job.
It has its own, separate SMTP secrets set via `supabase secrets set` — see
`docs/NEXT_ACTION.md` for the exact command. (Two Netlify
`-scheduled.js` functions existed briefly with the same intent; they were
never actually wired to anything and were removed 2026-08-24.)

If `SMTP_HOST` isn't set, these functions log a warning and skip sending
rather than crashing — safe to deploy before SMTP is configured, but nothing
will actually be delivered until it is.

## MailerSend — removed 2026-08-24

This project previously used MailerSend (`MAILERSEND_TOKEN`). That's been
replaced entirely by direct SMTP as described above. If `MAILERSEND_TOKEN`
is still set as a Netlify environment variable, it's now unused and safe to
delete. The old committed MailerSend token (see `docs/SECURITY_HARDENING.md`
item 1) should still be revoked in the MailerSend dashboard regardless,
since it was exposed in git history independent of whether the app uses it.

## Testing

There's no automated test for actual email delivery (would require a real
SMTP account). After configuring SMTP, manually trigger one email path
(e.g. register a test account, or call `send_email` with a test payload) and
confirm it arrives, ideally against a staging environment
(`docs/operations/STAGING_SETUP.md`) rather than production.
