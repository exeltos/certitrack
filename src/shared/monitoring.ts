// Frontend error monitoring (Sentry). It does nothing unless SENTRY_DSN is set
// in src/config/appConfig.ts, so it is safe to call unconditionally.
// Note: loading Sentry from its CDN also needs that host in the CSP
// (netlify.toml, script-src and connect-src). See docs/MONITORING_SETUP.md.
import { SENTRY_DSN } from '../config/appConfig';

interface SentryLike {
  init(options: Record<string, unknown>): void;
  captureException(error: unknown, context?: { extra?: Record<string, unknown> }): void;
}

let initialized = false;
let sentry: SentryLike | null = null;

export async function initMonitoring(): Promise<void> {
  if (initialized || !SENTRY_DSN) return;
  initialized = true;
  try {
    const url = 'https://cdn.jsdelivr.net/npm/@sentry/browser@8/+esm';
    const mod = await import(/* @vite-ignore */ url) as SentryLike;
    mod.init({
      dsn: SENTRY_DSN,
      environment: location.hostname === 'localhost' ? 'development' : 'production',
      tracesSampleRate: 0.1,
      // Certificate and company data can appear in URLs and breadcrumbs.
      sendDefaultPii: false
    });
    sentry = mod;
  } catch (err) {
    // Monitoring must never break the app it is monitoring.
    console.warn('[monitoring] Sentry failed to load; continuing without it.', err);
  }
}

/** Report an error with context, e.g. captureError(err, { area: 'upload' }). */
export function captureError(error: unknown, context: Record<string, unknown> = {}): void {
  if (sentry) sentry.captureException(error, { extra: context });
  else console.error('[monitoring:fallback]', error, context);
}
