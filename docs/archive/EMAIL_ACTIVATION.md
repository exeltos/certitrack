# Transactional Email Activation — Central SMTP provider Pipeline

CertiTrack uses one email pipeline:

`email_outbox -> process-notifications -> SMTP provider`

No SMTP provider configuration is required.

## Existing live Supabase project

1. Run `supabase/migrations/20260811_relationship_email_pipeline.sql` once. If it already succeeded, do not run it again unnecessarily.
2. Deploy/update the Edge Function from `supabase/functions/process-notifications/index.ts`.
3. Keep the existing `SMTP provider_API_KEY` custom secret.
4. Add `EMAIL_FROM` using a sender on a domain accepted by SMTP provider.
5. Add a long random `CRON_SECRET`.
6. `APP_URL` is optional; production defaults to `https://www.certitrack.gr`.
7. Invoke the worker securely using the same `CRON_SECRET` in the `x-cron-secret` header.
8. Create a new collaboration request and verify that the matching `email_outbox` row becomes `sent` and receives a provider message ID.

## Design rule

Do not add separate email providers/functions for individual modules. All transactional CertiTrack email should enter `email_outbox` and be delivered by `process-notifications`.

Do not place `SMTP provider_API_KEY`, Supabase secret keys, or `CRON_SECRET` in frontend JavaScript or GitHub.

---
**Archived 2026-08-24.** This described a SMTP provider-based pipeline that was
never the one actually deployed (the live Edge Function used SMTP provider,
then was switched to direct SMTP — see `docs/operations/EMAIL_SETUP.md`).
The `SMTP provider_API_KEY` secret and the Edge Function that used it
(`send_certificate_email`) were both deleted the same day as unused/broken.
