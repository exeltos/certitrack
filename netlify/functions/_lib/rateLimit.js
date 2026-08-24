// Shared rate-limit helper for public Netlify functions.
// Requires the Phase 50 migration (ct_check_rate_limit) to be applied.
//
// Usage:
//   const allowed = await checkRateLimit(supabase, `reset_password:${email}`, 5, 15 * 60);
//   if (!allowed) return tooManyRequests();

export async function checkRateLimit(supabase, bucketKey, maxCount, windowSeconds) {
  const { data, error } = await supabase.rpc('ct_check_rate_limit', {
    p_bucket_key: bucketKey,
    p_max_count: maxCount,
    p_window_seconds: windowSeconds
  });

  if (error) {
    // Fail OPEN but log loudly: a broken rate limiter should not take down
    // password reset / signup for every user. Alerting (see MONITORING.md)
    // should surface repeated failures here.
    console.error('[rateLimit] ct_check_rate_limit failed, allowing request:', error.message);
    return true;
  }

  return data === true;
}

// Best-effort caller identifier from a Netlify Functions event.
// Netlify sets x-nf-client-connection-ip; fall back to the standard header.
export function clientIp(event) {
  return (
    event.headers?.['x-nf-client-connection-ip'] ||
    event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export function tooManyRequestsResponse(extraHeaders = {}) {
  return {
    statusCode: 429,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Retry-After': '900',
      ...extraHeaders
    },
    body: 'Too many requests. Please try again later.'
  };
}
