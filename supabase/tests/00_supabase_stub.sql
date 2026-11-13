-- Minimal stand-in for the parts of Supabase (roles, auth, storage) that the
-- schema depends on, so it can be tested on a plain Postgres. Test-only.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null);
create function storage.extension(name text) returns text language sql immutable as $$
  select reverse(split_part(reverse(name), '.', 1))
$$;
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, service_role;
grant select, insert on storage.objects to authenticated;
grant all on storage.objects to service_role;
grant usage on schema public to anon, authenticated, service_role;
