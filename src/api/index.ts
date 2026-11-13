// The one data API the pages use: Supabase, or the in-browser demo network.
// The demo module is a separate chunk, downloaded only while a demo is running.
import { supabaseApi } from './supabase';
import { demoRole } from './demoFlag';
import type { Api } from '../types/domain';

export const api: Api = demoRole() ? (await import('./demo')).demoApi : supabaseApi;
export const isDemo = (): boolean => api.mode === 'demo';
export { startDemo, endDemo, DEMO_OPEN } from './demoFlag';
