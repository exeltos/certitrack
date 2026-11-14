// Server-side error monitoring for Netlify Functions (Sentry).
// Does nothing unless SENTRY_DSN is set in Netlify and @sentry/node is
// installed (see docs/operations/MONITORING_SETUP.md).

interface SentryLike {
  init(options: Record<string, unknown>): void;
  captureException(error: unknown, context?: { extra?: Record<string, unknown> }): void;
}

let sentry: SentryLike | null = null;
let initTried = false;

async function getSentry(): Promise<SentryLike | null> {
  if (initTried) return sentry;
  initTried = true;
  if (!process.env.SENTRY_DSN) return null;
  try {
    const name = '@sentry/node';   // optional dependency, resolved at run time
    sentry = await import(name) as SentryLike;
    sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
  } catch (err) {
    console.warn('[monitoring] @sentry/node not installed or failed to init:', err instanceof Error ? err.message : err);
    sentry = null;
  }
  return sentry;
}

export async function captureError(error: unknown, context: Record<string, unknown> = {}): Promise<void> {
  const s = await getSentry();
  if (s) s.captureException(error, { extra: context });
  else console.error('[monitoring:fallback]', error, context);
}
