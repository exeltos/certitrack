// Frontend error monitoring.
//
// Setup required (one-time, not something this codebase can do for you):
//   1. Create a free/paid project at https://sentry.io (or self-host).
//   2. Copy its DSN (Settings -> Client Keys). A DSN is safe to ship to the
//      browser -- it is not a secret, it only identifies where events go.
//   3. Set SENTRY_DSN below via src/config/appConfig.js (same pattern as
//      SUPABASE_URL/SUPABASE_ANON_KEY), or leave it unset to no-op.
//
// This module intentionally has zero effect if no DSN is configured, so it
// is safe to import from appShell.js unconditionally.

import { SENTRY_DSN } from '../config/appConfig.js';

let initialized = false;

export async function initMonitoring() {
  if (initialized || !SENTRY_DSN) return;
  initialized = true;

  try {
    const Sentry = await import('https://cdn.jsdelivr.net/npm/@sentry/browser@8/+esm');
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: window.location.hostname === 'localhost' ? 'development' : 'production',
      tracesSampleRate: 0.1,
      // Certificates/company data can appear in URLs and breadcrumbs; keep
      // Sentry from hoovering up request bodies or PII by default.
      sendDefaultPii: false
    });
    window.__ctSentry = Sentry;
  } catch (err) {
    // Monitoring must never break the app it's monitoring.
    console.warn('[monitoring] Sentry failed to load; continuing without it.', err);
  }
}

// Call from any catch block where you want an error reported with context,
// e.g. captureError(err, { area: 'certificateUpload', organizationId }).
export function captureError(error, context = {}) {
  if (window.__ctSentry) {
    window.__ctSentry.captureException(error, { extra: context });
  } else {
    console.error('[monitoring:fallback]', error, context);
  }
}
