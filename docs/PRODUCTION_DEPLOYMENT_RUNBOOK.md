# CertiTrack — Production Supabase Deployment Runbook

Target Project Ref: `klutmusrabsizqjnzwpu`

## Current verified state
Read-only preflight on 2026-08-10 showed:
- auth.users: 0
- companies: 0
- suppliers: 0
- company_certificates: 0
- supplier_certificates: 0
- company_suppliers: 0
- requirements/notifications/audit: 0
- certificate_types: 10
- legacy buckets: `companycertificates`, `suppliercertificates` (public)

The old buckets are deliberately not deleted by this deployment.

## Deployment sequence

### Stage A — database
1. Run `00_preflight_assertions.sql`.
2. If it passes, run `01_certitrack_production_schema.sql`.
3. Run `03_validate_schema.sql`.
4. Stop if model version is not `39`, expected tables are missing, or `organizationcertificates` is public.

### Stage B — Auth
Configure the settings in `docs/PRODUCTION_AUTH_SETUP.md`.
Do not create public users until Confirm Email and redirect URLs are correct.

### Stage C — notification infrastructure
1. Run `02_enable_notification_extensions.sql`.
2. Deploy `process-notifications`.
3. Configure Edge Function secrets:
   - CRON_SECRET
   - SMTP_PASSWORD
   - EMAIL_FROM
   - APP_URL
4. Test the Edge Function manually with the cron secret.
5. Only then configure Vault/Cron using `05_schedule_notifications.sql.template`.

### Stage D — first accounts and security tests
1. Register Organization A.
2. Confirm email.
3. Confirm exactly one Organization and one owner membership were created.
4. Register Organization B and confirm.
5. Test relationship invitation/acceptance.
6. Upload private and partner-visible PDFs.
7. Verify B sees only shared current PDFs.
8. Verify unrelated users cannot read A/B data.
9. Test reset-password flow.
10. Test expiry notification generation.

### Stage E — Platform Admin
Create/confirm the intended admin Auth user, then use
`04_make_platform_admin.sql.template` after replacing the UUID.

## Legacy cleanup
Do not remove legacy tables or buckets during initial go-live.
They are empty but remain a rollback/reference checkpoint.
Clean them only after the new production flow has been validated.


## CLI commands used later

Project is already linked to:
`klutmusrabsizqjnzwpu`

Deploy the notification function after database/Auth setup:

```powershell
npx supabase functions deploy process-notifications --project-ref klutmusrabsizqjnzwpu --no-verify-jwt
```

Set secrets without committing them:

```powershell
npx supabase secrets set CRON_SECRET="..." SMTP_PASSWORD="..." EMAIL_FROM="..." APP_URL="https://www.certitrack.gr" --project-ref klutmusrabsizqjnzwpu
```

Do not paste secret values into GitHub or frontend `.js` files.
