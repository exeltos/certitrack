# Transactional Email Activation — Central Resend Pipeline

CertiTrack uses one email pipeline:

`email_outbox -> process-notifications -> Resend`

No MailerSend configuration is required.

## Existing live Supabase project

1. Run `supabase/migrations/20260811_relationship_email_pipeline.sql` once. If it already succeeded, do not run it again unnecessarily.
2. Deploy/update the Edge Function from `supabase/functions/process-notifications/index.ts`.
3. Keep the existing `RESEND_API_KEY` custom secret.
4. Add `EMAIL_FROM` using a sender on a domain accepted by Resend.
5. Add a long random `CRON_SECRET`.
6. `APP_URL` is optional; production defaults to `https://www.certitrack.gr`.
7. Invoke the worker securely using the same `CRON_SECRET` in the `x-cron-secret` header.
8. Create a new collaboration request and verify that the matching `email_outbox` row becomes `sent` and receives a provider message ID.

## Design rule

Do not add separate email providers/functions for individual modules. All transactional CertiTrack email should enter `email_outbox` and be delivered by `process-notifications`.

Do not place `RESEND_API_KEY`, Supabase secret keys, or `CRON_SECRET` in frontend JavaScript or GitHub.

---
**Archived 2026-08-24.** This described a Resend-based pipeline that was
never the one actually deployed (the live Edge Function used MailerSend,
then was switched to direct SMTP — see `docs/operations/EMAIL_SETUP.md`).
The `RESEND_API_KEY` secret and the Edge Function that used it
(`send_certificate_email`) were both deleted the same day as unused/broken.
