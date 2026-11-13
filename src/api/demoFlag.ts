// The in-browser demo: a network of sample organizations that lives only in
// this browser tab. It contains no real data.
//
// DEMO_OPEN (development and the e2e tests, VITE_ENABLE_DEMO=true): anyone can
// start it, and the home page offers it. On the real site it is reached only
// from the platform owner's menu, and every demo page first checks with the
// server that the signed-in user is a platform administrator (see shell.js).
export const DEMO_OPEN: boolean = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === 'true';

const ROLE_KEY = 'certitrack.demo';
const STORE_KEY = 'certitrack.demo.store.v2';
export type DemoRole = 'organization' | 'admin';

export function demoRole(): DemoRole | null {
  try { const r = localStorage.getItem(ROLE_KEY); return r === 'admin' || r === 'organization' ? r : null; } catch { return null; }
}
export function startDemo(role: DemoRole): void {
  try { localStorage.setItem(ROLE_KEY, role); sessionStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
}
export function endDemo(): void {
  try { localStorage.removeItem(ROLE_KEY); sessionStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
}
