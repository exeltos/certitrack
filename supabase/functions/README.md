# Supabase Edge Functions

## process-notifications
Scheduled server-side worker for:
1. generating certificate expiry/expired notifications,
2. claiming pending email outbox messages,
3. sending transactional email,
4. recording delivery success/failure.

Required secrets at deployment:
- `CRON_SECRET`
- `MAILERSEND_TOKEN`
- `EMAIL_FROM`
- `APP_URL`

Supabase-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are used server-side only.

Do not commit real secret values.
