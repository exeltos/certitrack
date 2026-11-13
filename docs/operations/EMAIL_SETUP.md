# Email setup

Two kinds of email, both over your SMTP provider:

1. **Auth emails** (confirm sign-up, reset password): sent by Supabase Auth.
   Configure Custom SMTP in Dashboard → Authentication → SMTP Settings and paste
   the templates from `supabase/email-templates/`.
2. **Notifications** (connection requests, document requests, expiry reminders,
   invitations): queued by the database in `email_outbox` and sent by the
   `process-notifications` Edge Function. Set its SMTP secrets as described in
   `docs/DEPLOYMENT.md` §4.

Test: register a test organization (auth email), then connect two test
organizations (notification email), and check `email_outbox.status` becomes `sent`.
Failed rows keep `last_error` and are retried with back-off up to 5 times.
