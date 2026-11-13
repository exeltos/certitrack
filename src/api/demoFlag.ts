// Whether the in-browser demo exists in this build. It is off in production
// (the public site has no demo); development and the e2e tests turn it on with
// VITE_ENABLE_DEMO=true. When off, the demo code and data are not even bundled.
export const DEMO_ENABLED: boolean = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === 'true';

const ROLE_KEY = 'certitrack.demo';
const STORE_KEY = 'certitrack.demo.store.v2';
export type DemoRole = 'organization' | 'admin';

export function demoRole(): DemoRole | null {
  if (!DEMO_ENABLED) return null;
  try { const r = localStorage.getItem(ROLE_KEY); return r === 'admin' || r === 'organization' ? r : null; } catch { return null; }
}
export function startDemo(role: DemoRole): void {
  try { localStorage.setItem(ROLE_KEY, role); sessionStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
}
export function endDemo(): void {
  try { localStorage.removeItem(ROLE_KEY); sessionStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
}
