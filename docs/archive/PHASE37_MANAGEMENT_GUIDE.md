# Phase 37 — Management Guide

## What changed
- Global in-app Notification Center on all Organization pages.
- User notification preferences in Settings.
- Expiry warning thresholds configurable per user.
- Daily expiry engine for upcoming and expired certificates.
- Idempotent notification generation using dedupe keys.
- Server-side `email_outbox` with retry state; email delivery never runs from browser JavaScript.
- Relationship invitation/accept/decline emails are queued centrally.
- Supabase Edge Function `process-notifications` processes the queue.
- Scheduled invocation template prepared with Supabase Cron + pg_net + Vault.
- Old direct Netlify relationship invitation mailer moved to legacy archive to avoid dual delivery.

## What you do now
**Nothing in Supabase yet.**
Keep this Phase37 ZIP as the current checkpoint.

## Do NOT do yet
- Do not run migrations 33/35/36/37.
- Do not enable Cron manually.
- Do not deploy the Edge Function yet.
- Do not create Vault secrets.
- Do not add your MailerSend token to the repository.
- Do not run `phase37_schedule.sql.template`.
- Do not delete legacy tables or notification tables.

## Deployment requirements later
At the controlled deployment checkpoint we will need:
1. Supabase Project Ref / CLI access.
2. A backup/preflight of the actual project.
3. A verified sender/domain in the chosen transactional email provider.
4. `MAILERSEND_TOKEN` as an Edge Function secret.
5. A new random `CRON_SECRET`.
6. `EMAIL_FROM` and production `APP_URL`.
7. Deployment of `process-notifications`.
8. Vault secrets for the scheduler.
9. Daily Cron activation only after manual function testing.

## Default notification schedule
Prepared defaults:
- 90 days
- 60 days
- 30 days
- 15 days
- 7 days
- day of expiry
- one persistent expired alert after expiry

Each user can enable/disable email and in-app delivery and choose the warning thresholds.

## Important behavior
The engine does not send the same threshold twice.
If the scheduler runs late, it chooses the closest applicable configured threshold rather than sending every missed historical warning.

## Acceptance tests after deployment
- Create certificate expiring in 90 days -> one notification + one email queued.
- Run generator again -> no duplicate.
- Change test expiry to 30 days -> new 30-day warning.
- Test day 0.
- Test expired certificate -> exactly one expired alert.
- Disable email preference -> in-app remains, no email outbox entry.
- Disable in-app -> email remains if enabled.
- Disable both -> no user delivery.
- Invitation to registered org -> in-app + email according to preferences.
- Invitation to unregistered email -> one invitation email.
- Accept/decline -> requester receives notification/email.
- Edge worker failure -> retry state recorded without duplicate email row.
