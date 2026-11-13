// The one data API the pages use: Supabase, or (development/tests only) the
// in-browser demo network. In production builds DEMO_ENABLED is false, so the
// demo module is never loaded and is left out of the bundle.
import { supabaseApi } from './supabase';
import { demoRole } from './demoFlag';
import type { Api } from '../types/domain';

// The flag is spelled out here (not imported) so the bundler can see it is
// false in production and drop the demo chunk entirely.
export const api: Api = (import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === 'true') && demoRole() ? (await import('./demo')).demoApi : supabaseApi;
export const isDemo = (): boolean => api.mode === 'demo';
export { startDemo, endDemo, DEMO_ENABLED } from './demoFlag';
