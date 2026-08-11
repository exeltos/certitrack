# CertiTrack Phase 49 — Canonical Consolidated Status

## Canonical email architecture

CertiTrack -> `email_outbox` -> `process-notifications` -> MailerSend

Provider: MailerSend
Verified sending domain: `certitrack.gr`
Default sender expected: `noreply@certitrack.gr`

Required Supabase Edge Function secrets:
- `MAILERSEND_TOKEN`
- `EMAIL_FROM`
- `APP_URL`
- `CRON_SECRET`

Never commit secret values to Git.

## Relationship behavior

- New request: creates `pending` relationship and `relationship_invite` outbox item.
- Cancel pending request: deletes the relationship; unsent invite queue item is removed.
- Accept: relationship becomes `active`.
- Decline: handled by relationship response flow and may enqueue a decline notification.
- End active relationship: status becomes `ended`.
- A previously cancelled request can be created again.

## Current delivery limitation

The application/email queue and Edge Function were verified to execute.
MailerSend returned `MS42225` because the trial account reached its unique-recipient limit.
This is an external account-plan limitation, not a CertiTrack/Supabase failure.

## Deployment rule

For an existing live Supabase project, do NOT run `supabase/FULL_SETUP.sql`.
Apply only migrations that have not already been applied.

## Remaining production operation

Configure an automatic scheduler/cron to invoke `process-notifications` with the
`x-cron-secret` header. Manual Edge Function Test is only for diagnostics.

Do not remove legacy email functions/secrets until the central MailerSend worker has
successfully delivered production test messages after the MailerSend account limitation is resolved.
