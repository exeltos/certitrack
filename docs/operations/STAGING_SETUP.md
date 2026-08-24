# Staging Environment Setup

Right now there is one Supabase project and it *is* production — every
migration you test is tested live. This guide sets up a second, isolated
project so schema changes can be validated before they touch real customer
data.

## 1. Create a second Supabase project

1. In the Supabase dashboard, create a new project, e.g. `certitrack-staging`.
2. Note its URL and anon key (Project Settings → API).
3. Apply the canonical schema to it the same way you plan to apply it to
   production: `supabase/production/00_preflight_assertions.sql`, then
   `01_certitrack_production_schema.sql`, following `NEXT_ACTION.md`.
4. Load `demoData.js`-style seed data (or a scrubbed export of production —
   never copy real customer PII into staging) so the app has something to
   show.

## 2. Create a second Netlify site (or a branch deploy)

Two options:

- **Simplest**: use Netlify's branch deploys. Push a `staging` branch;
  Netlify will build a preview URL for it automatically once configured in
  Site settings → Build & deploy → Branch deploys.
- **More isolated**: a fully separate Netlify site pointed at the same repo,
  with its own environment variables. Better if staging and production need
  to run different environment variable sets simultaneously (they will,
  since they point at different Supabase projects).

## 3. Environment variables for staging

Set on the staging Netlify site (Site settings → Environment variables):

```
SUPABASE_URL=<staging project URL>
SUPABASE_SERVICE_ROLE_KEY=<staging service role key>
SMTP_HOST=<a sandbox/test SMTP account, NOT the production one — see docs/operations/EMAIL_SETUP.md>
EMAIL_FROM=noreply@staging.certitrack.gr   (or similar — do not send test email as the real sender)
APP_URL=<staging site URL>
CRON_SECRET=<a different secret than production>
SENTRY_DSN=<optionally a separate Sentry project/environment tag>
```

For the frontend config (`src/config/appConfig.js`), since this is a static
no-build site, you'll need either:
- A staging-specific copy of `appConfig.js` deployed only to the staging
  site (simplest given the current no-build setup), or
- A small build step that injects the right config per environment (a
  bigger change — only worth it once you're maintaining staging regularly).

## 4. Workflow

1. Write and test a migration against staging first.
2. Run staging's own preflight/validation scripts
   (`supabase/production/03_validate_schema.sql`) against staging.
3. Only once staging is green, follow the same steps against production per
   `NEXT_ACTION.md`.
4. Point CI (`.github/workflows/ci.yml`) at staging for any future
   integration tests that need a real database, never at production.

## 5. What NOT to do

- Don't put real customer data in staging without scrubbing PII first —
  it's still subject to your Privacy Policy commitments.
- Don't reuse the production SMTP credentials in staging — a staging bug
  that mass-sends email will burn your production sending reputation and
  your email provider's quota.
