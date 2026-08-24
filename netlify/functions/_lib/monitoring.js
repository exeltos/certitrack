// Server-side error monitoring for Netlify Functions.
//
// Setup required (see docs/MONITORING_SETUP.md):
//   1. Same Sentry project as the frontend, or a separate one if you want to
//      tell client vs. server errors apart at a glance.
//   2. Set the SENTRY_DSN environment variable in Netlify (Site settings ->
//      Environment variables). This one CAN be the same public DSN used in
//      the browser, or a distinct server DSN -- your choice.
//
// No-ops safely if SENTRY_DSN is not set, so it's safe to require()
// unconditionally from any function.

let sentry = null;
let initTried = false;

function getSentry() {
  if (initTried) return sentry;
  initTried = true;
  if (!process.env.SENTRY_DSN) return null;
  try {
    // eslint-disable-next-line global-require
    sentry = require('@sentry/node');
    sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
  } catch (err) {
    console.warn('[monitoring] @sentry/node not installed or failed to init:', err.message);
    sentry = null;
  }
  return sentry;
}

function captureError(error, context = {}) {
  const s = getSentry();
  if (s) {
    s.captureException(error, { extra: context });
  } else {
    console.error('[monitoring:fallback]', error, context);
  }
}

module.exports = { captureError };
