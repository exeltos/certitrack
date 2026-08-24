-- Phase 53 — Idempotency for scheduled notification emails.
--
-- notify_expiring_certificates-scheduled.js and notify_user_expiry-scheduled.js
-- had no de-duplication at all: every invocation recomputes "is this due for
-- a reminder" from scratch and sends unconditionally. A retried cron run, a
-- manual re-trigger, or Netlify running the schedule twice in the same
-- window would send duplicate reminder emails.
--
-- This adds a small table with a unique constraint used as an atomic
-- "claim" -- a function inserts a dedupe key, and only sends the email if
-- the insert actually happened (i.e. this exact reminder wasn't already
-- sent). Uses ON CONFLICT DO NOTHING so it's safe under concurrent/retried
-- invocations without needing application-level locking.

create table if not exists public.sent_notification_log (
  dedupe_key text primary key,
  sent_at timestamptz not null default now()
);

-- Housekeeping: dedupe keys older than 400 days are safe to drop (a full
-- year of certificate cycles plus slack). Call opportunistically from the
-- scheduled functions; cheap once indexed (primary key covers lookups).
create or replace function public.ct_sent_notification_log_cleanup()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.sent_notification_log where sent_at < now() - interval '400 days';
$$;

-- Atomically claims a dedupe key. Returns true if this call is the first to
-- claim it (i.e. the caller should send the notification), false if it was
-- already claimed (i.e. skip sending -- already sent).
create or replace function public.ct_claim_notification(p_dedupe_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sent_notification_log (dedupe_key) values (p_dedupe_key)
  on conflict (dedupe_key) do nothing;
  return found;
end;
$$;

revoke all on function public.ct_claim_notification(text) from public, authenticated, anon;
revoke all on function public.ct_sent_notification_log_cleanup() from public, authenticated, anon;
-- Only callable with the service-role key, from the scheduled functions.

alter table public.sent_notification_log enable row level security;
-- No policies for anon/authenticated: service role only (bypasses RLS).
