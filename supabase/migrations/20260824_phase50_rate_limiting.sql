-- Phase 50 — Rate limiting for unauthenticated public endpoints
-- (password reset, email sending, signup invites).
--
-- These Netlify functions run with the service-role key and are reachable
-- without a Supabase session, so RLS cannot protect them. This gives them
-- a shared, atomic counter to throttle abuse (credential stuffing, mail-bombing,
-- reset-link spam) without needing an external Redis/Upstash service.
--
-- Apply with the rest of the Phase 50 migrations. Safe to re-run.

create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  bucket_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_bucket_created_idx
  on public.rate_limit_events (bucket_key, created_at desc);

-- Housekeeping: drop events older than 1 day so the table doesn't grow forever.
-- Safe to call repeatedly; cheap once indexed.
create or replace function public.ct_rate_limit_cleanup()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limit_events where created_at < now() - interval '1 day';
$$;

-- Atomically checks + records a rate-limit hit.
-- Returns true if the call is ALLOWED, false if the caller is OVER the limit.
-- bucket_key should combine the endpoint name and a caller identifier, e.g.
-- 'reset_password:user@example.com' or 'send_email:203.0.113.4'.
create or replace function public.ct_check_rate_limit(
  p_bucket_key text,
  p_max_count int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  perform public.ct_rate_limit_cleanup();

  select count(*) into v_count
  from public.rate_limit_events
  where bucket_key = p_bucket_key
    and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max_count then
    return false;
  end if;

  insert into public.rate_limit_events (bucket_key) values (p_bucket_key);
  return true;
end;
$$;

-- Only the service role should ever call this (it's invoked from Netlify
-- functions using SUPABASE_SERVICE_ROLE_KEY, never from the browser client).
revoke all on function public.ct_check_rate_limit(text, int, int) from public, authenticated, anon;
revoke all on function public.ct_rate_limit_cleanup() from public, authenticated, anon;

alter table public.rate_limit_events enable row level security;
-- No policies granted to anon/authenticated: only the service role (which
-- bypasses RLS) can read/write this table.
