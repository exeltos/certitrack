# Phase 37 — Notifications, Expiry Engine & Email Delivery
- Added global Notification Center.
- Added Settings controls for notification preferences and expiry thresholds.
- Added daily expiry/expired notification generator with database dedupe.
- Added server-only email_outbox and retry lifecycle.
- Added Supabase Edge Function for email delivery.
- Added queued relationship invitation/response emails.
- Removed the active direct Netlify relationship-email flow.
- Added Cron/Vault deployment template (not executable as-is).
- No production Supabase changes performed.
