# Supabase Edge Functions

## process-notifications
Scheduled server-side worker for:
1. generating certificate expiry/expired notifications,
2. claiming pending email outbox messages,
3. sending transactional email via SMTP,
4. recording delivery success/failure.

This is the actual, live notification pipeline — triggered by the
`certitrack-daily-notifications` pg_cron job (see
`supabase/production/05_schedule_notifications.sql.template`), which POSTs
here once a day. The Netlify `-scheduled.js` functions of the same era were
a separate, unused parallel implementation and were removed 2026-08-24 to
avoid confusion — this is the one that actually runs.

Required secrets at deployment (`supabase secrets set ...`):
- `CRON_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`
- `EMAIL_FROM`, `EMAIL_FROM_NAME`
- `APP_URL`

Supabase-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are used server-side only.

Do not commit real secret values.

Switched from MailerSend to direct SMTP (via `denomailer`) on 2026-08-24 —
see `docs/operations/EMAIL_SETUP.md`.
