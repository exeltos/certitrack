# Phase 37 — Notification Architecture

```text
certificates / relationships
          |
          v
Postgres notification generator / triggers
          |
          +----------------------+
          |                      |
          v                      v
notifications              email_outbox
(in-app, RLS)              (server-only)
          |                      |
          v                      v
Header Notification       Supabase Edge Function
Center                    process-notifications
                                 |
                                 v
                         transactional email provider
                                 |
                                 v
                           delivery state / retry
```

## Security boundaries
- Browser users cannot read `email_outbox`.
- Provider API token exists only as an Edge Function secret.
- The scheduled Edge Function is protected by a separate `CRON_SECRET`.
- Scheduler secrets are stored in Supabase Vault at deployment.
- Notification rows use RLS and are visible only to the intended user/platform admin.
- Dedupe keys enforce idempotency at database level.

## Scheduling
The repository contains `supabase/deployment/phase37_schedule.sql.template`.
It is intentionally not a migration because it depends on production project URL and secrets.

## Email provider
The canonical worker now uses Resend as the single transactional email provider.
Provider access is isolated to the Edge Function and can be swapped later without changing certificate/notification tables.
