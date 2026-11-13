// Supabase auth links (password recovery from the app or from the Supabase
// dashboard, expired links) can land on any page of the site, usually the
// site URL (home). Send them to the page that can handle them, keeping the
// tokens in the URL so supabase-js can pick them up there.
export const RESET_PATH = '/pages/auth/reset-password.html';

export function authCallbackTarget(loc: Pick<Location, 'pathname' | 'search' | 'hash'>): string | null {
  if (loc.pathname === RESET_PATH) return null;
  const hash = new URLSearchParams(loc.hash.replace(/^#/, ''));
  const query = new URLSearchParams(loc.search);
  const type = hash.get('type') ?? query.get('type');
  const failedLink = hash.has('error_code') || query.has('error_code');
  if (type === 'recovery' || (failedLink && !loc.pathname.startsWith('/pages/organization/'))) {
    return RESET_PATH + loc.search + loc.hash;
  }
  return null;
}

/** Returns true when the page is being redirected and should not render. */
export function redirectAuthCallback(): boolean {
  const target = authCallbackTarget(window.location);
  if (target) window.location.replace(target);
  return target !== null;
}
