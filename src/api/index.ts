// The one data API the pages use. In demo mode it is backed by an in-browser
// copy of the network (src/api/demo.ts); otherwise by Supabase.
import { demoApi, demoRole } from './demo';
import { supabaseApi } from './supabase';
import type { Api } from '../types/domain';

export const api: Api = demoRole() ? demoApi : supabaseApi;
export const isDemo = (): boolean => api.mode === 'demo';
export { startDemo, endDemo } from './demo';
