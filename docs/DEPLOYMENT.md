# Deployment

## 1. Database

Fresh project:

1. Apply `supabase/migrations/*.sql` in order (SQL editor, or `supabase db push`).
2. Verify locally first with `npm run test:db`.

Moving the existing pre-2026-11 project onto the peer model (**deletes all data**):

1. Run `supabase/reset/00_drop_previous_schema.sql`.
2. Apply `supabase/migrations/20261113000000_peer_network_baseline.sql`.
3. Empty the `organizationcertificates` bucket and delete old test users
   (Dashboard → Storage / Authentication).

## 2. Auth settings (Dashboard → Authentication)

- Confirm email: **ON**. Password: min 12, upper + lower + number + symbol.
- Site URL: `https://www.certitrack.gr`
- Redirect URLs: `https://www.certitrack.gr/pages/auth/login.html`,
  `https://www.certitrack.gr/pages/auth/reset-password.html`
- Custom SMTP (the built-in sender is not for production); templates in
  `supabase/email-templates/`.

## 3. Platform admin account

The platform owner logs in at the normal login page and is sent to `/pages/admin/`.

1. Dashboard → Authentication → **Add user** → email + password (you choose it),
   tick *Auto Confirm User*. Do **not** sign up through the app's register page
   (that creates an organization).
2. Grant admin rights in the SQL editor:
   ```sql
   insert into public.platform_admins(user_id)
   select id from auth.users where email = 'ADMIN_EMAIL_HERE';
   ```
3. Enable two-factor authentication for this account.

## 4. Notifications

Deploy `supabase/functions/process-notifications` and set its secrets:
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`,
`EMAIL_FROM`, `EMAIL_FROM_NAME`, `APP_URL`, `CRON_SECRET`.
Schedule it with pg_cron (e.g. every 10 minutes; reminders are de-duplicated,
so running often is safe) and send `x-cron-secret`.

## 5. Frontend (Netlify)

Netlify runs `npm run build` and publishes `dist/` (see `netlify.toml`).
`src/config/appConfig.ts` must point at the same Supabase project. For the erasure tool set `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` as Netlify environment variables.

After changing page list or icons:
`node scripts/build-pages.mjs`, `node scripts/build-icons.mjs <lucide package dir>`.
