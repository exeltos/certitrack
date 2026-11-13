// The one data API the pages use. In demo mode it is backed by an in-browser
// copy of the network (src/api/demo.js); otherwise by Supabase.
import { demoApi, demoRole } from './demo.js';
import { supabaseApi } from './supabase.js';

export const api = demoRole() ? demoApi : supabaseApi;
export const isDemo = () => api.mode === 'demo';
export { startDemo, endDemo } from './demo.js';
