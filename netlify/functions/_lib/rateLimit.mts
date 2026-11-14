// Shared rate-limit helper for Netlify functions (uses ct_check_rate_limit).
//   const allowed = await checkRateLimit(supabase, `reset_password:${email}`, 5, 15 * 60);
import type { SupabaseClient } from '@supabase/supabase-js';

export interface FunctionEvent {
  httpMethod: string;
  headers?: Record<string, string | undefined>;
  body?: string | null;
}
export interface FunctionResponse { statusCode: number; headers?: Record<string, string>; body?: string }

export async function checkRateLimit(supabase: SupabaseClient, bucketKey: string, maxCount: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('ct_check_rate_limit', {
    p_bucket_key: bucketKey,
    p_max_count: maxCount,
    p_window_seconds: windowSeconds
  });
  if (error) {
    // Fail open but log loudly: a broken limiter must not lock everyone out.
    console.error('[rateLimit] ct_check_rate_limit failed, allowing request:', error.message);
    return true;
  }
  return data === true;
}

/** Best-effort caller identifier (Netlify sets x-nf-client-connection-ip). */
export function clientIp(event: FunctionEvent): string {
  return event.headers?.['x-nf-client-connection-ip']
    || event.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || 'unknown';
}

export function tooManyRequestsResponse(extraHeaders: Record<string, string> = {}): FunctionResponse {
  return {
    statusCode: 429,
    headers: { 'Access-Control-Allow-Origin': '*', 'Retry-After': '900', ...extraHeaders },
    body: 'Too many requests. Please try again later.'
  };
}
