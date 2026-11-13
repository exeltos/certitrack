-- Move the access helpers used by RLS policies out of the API schema.
--
-- Policies need to call them as the querying role, but they must not be
-- callable as /rest/v1/rpc/... endpoints: e.g. ct_have_live_connection(a, b)
-- would otherwise let any signed-in user probe whether two other
-- organizations are connected. PostgREST only exposes the public schema.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

alter function public.ct_is_org_member(uuid, uuid) set schema private;
alter function public.ct_has_org_role(uuid, text[], uuid) set schema private;
alter function public.ct_current_org_ids() set schema private;
alter function public.ct_have_live_connection(uuid, uuid) set schema private;
alter function public.ct_org_can_view_certificate(uuid, uuid) set schema private;
alter function public.ct_can_view_certificate(uuid) set schema private;
alter function public.ct_recently_opened(uuid) set schema private;

-- Functions find each other by name, so every ct_ function now also searches
-- the private schema (keeping any extra schema it already used).
do $$
declare r record; v_path text;
begin
  for r in
    select p.oid, p.oid::regprocedure as sig, coalesce(
             (select substr(c, 13) from unnest(p.proconfig) c where c like 'search_path=%'), 'public') as path
    from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace) and p.proname like 'ct\_%'
  loop
    v_path := case when r.path like '%private%' then r.path else 'public, private' || regexp_replace(r.path, '^public', '') end;
    execute format('alter function %s set search_path = %s', r.sig, v_path);
  end loop;
end $$;
