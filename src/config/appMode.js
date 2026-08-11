/**
 * CertiTrack application mode helpers.
 * Demo mode is intentionally data-isolated from Supabase.
 */
export function getAppMode() {
  const path = window.location.pathname.toLowerCase();
  return path.includes('/pages/demo/') ? 'demo' : 'production';
}

export function isDemoMode() {
  return getAppMode() === 'demo';
}
