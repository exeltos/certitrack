# Monitoring Setup

Error tracking wiring is already in the codebase (`src/shared/monitoring.js`
for the browser, `netlify/functions/_lib/monitoring.js` for functions). It
no-ops until you complete this setup — nothing breaks if you skip it, but
you also won't hear about production errors until a user reports them.

## 1. Create a Sentry project

1. Sign up at https://sentry.io (free tier is enough to start) or self-host.
2. Create a JavaScript (Browser) project for the frontend, and a Node
   project for the Netlify functions — or one project for both if you'd
   rather keep it simple.
3. Copy the DSN for each.

## 2. Wire up the frontend DSN

Edit `src/config/appConfig.js`:

```js
export const SENTRY_DSN = 'https://xxxxx@xxxxx.ingest.sentry.io/xxxxx';
```

DSNs are safe to commit — they're not secrets, they only tell the SDK where
to send events (Sentry rate-limits and validates on their end).

## 3. Wire up the functions DSN

In Netlify: **Site settings → Environment variables**, add:

```
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
```

Then install the Node SDK so `netlify/functions/_lib/monitoring.js` can
`require('@sentry/node')`:

```
npm install @sentry/node
```

## 4. Uptime monitoring

Sentry tracks errors, not uptime. Add a separate uptime check for:

- The main site (`https://www.certitrack.gr`)
- The `process-notifications` Supabase Edge Function (hit it with a HEAD/GET
  on a schedule, or use Supabase's own function logs/alerts if available) —
  this is the real scheduled notification pipeline, triggered daily by
  pg_cron. Silent failure here is the main risk since there's no user-facing
  symptom until someone notices they didn't get a reminder.

Free options: UptimeRobot, Better Uptime, or Checkly. Point at least one
check at a Netlify function that queries the database, not just the static
homepage, so a Supabase outage is also caught.

## 5. Alerting

Once Sentry is receiving events, set up an alert rule (Sentry → Alerts) to
notify you by email/Slack when:
- A new error type appears for the first time.
- Error volume for `send_email` or the rate-limit check spikes (a spike here
  usually means either abuse or a broken integration).
