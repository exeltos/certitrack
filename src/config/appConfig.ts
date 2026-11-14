// Public client configuration. The anon key is meant to be public: every
// table is protected by row-level security on the server.
export const SUPABASE_URL = 'https://klutmusrabsizqjnzwpu.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdXRtdXNyYWJzaXpxam56d3B1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1NjUzMzAsImV4cCI6MjA2MjE0MTMzMH0.wU80uKyWW9iuNm0_6ghtvIJ_6SFMCv3RhSYodPMZOeg';

// Sentry DSN (public, write-only identifier). Empty disables error monitoring.
// See src/shared/monitoring.ts and docs/MONITORING_SETUP.md.
export const SENTRY_DSN: string = '';
