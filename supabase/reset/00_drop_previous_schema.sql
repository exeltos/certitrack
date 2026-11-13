-- =============================================================================
-- ONE-OFF: remove the pre-peer-model CertiTrack schema from an existing project
-- =============================================================================
-- DESTRUCTIVE. Deletes every CertiTrack table, function and policy in the
-- public schema, the CertiTrack auth triggers and storage policies, and all
-- data in them. Run only on a project whose data may be discarded, then apply
-- supabase/migrations/20261113000000_peer_network_baseline.sql.
--
-- Not touched (do these by hand if wanted):
--   * auth.users (login accounts). Old test users would have no organization
--     after the reset; delete them in Dashboard > Authentication.
--   * PDF files in the "organizationcertificates" bucket. Empty the bucket in
--     Dashboard > Storage (direct SQL deletes on storage.objects are blocked).
--   * pg_cron jobs and Edge Functions.
-- =============================================================================
begin;

drop trigger if exists ct_on_auth_user_created on auth.users;
drop trigger if exists ct_on_auth_user_verified on auth.users;
drop trigger if exists on_auth_user_created_certitrack_org on auth.users;

do $$
declare r record;
begin
  -- Every policy on storage.objects. The baseline recreates the ones it needs;
  -- older dashboard-made policies (e.g. "Enable insert for authenticated users
  -- only", which let anyone upload anything) must not survive.
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;

  -- All tables and views in public (CASCADE removes their policies/triggers).
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
  for r in select viewname from pg_views where schemaname = 'public' loop
    execute format('drop view if exists public.%I cascade', r.viewname);
  end loop;

  -- All functions in public that do not belong to an extension.
  for r in select p.oid::regprocedure as sig
           from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and not exists(select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
end $$;

commit;
