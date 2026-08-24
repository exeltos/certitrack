# Phase 48.4 — Centralized Resend Email Pipeline

- Standardized all transactional CertiTrack email on Resend.
- Reused the existing `RESEND_API_KEY` Supabase secret.
- Removed MailerSend dependency/configuration from the canonical worker.
- Kept one central worker: `process-notifications`.
- Added Resend idempotency keys per `email_outbox` row to reduce duplicate-send risk.
- Added Resend application/template tags.
- Kept collaboration invitation/accepted/declined and certificate expiry/expired templates in one place.
- Updated email activation and function deployment documentation.
- No additional database migration is required beyond the already-applied Phase 48.3 migration.
