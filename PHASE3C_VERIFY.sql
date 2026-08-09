-- Phase 3C verification (read-only)

select id, name, public
from storage.buckets
where id in ('suppliercertificates','companycertificates')
order by id;

select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    policyname like 'companycertificates_%'
    or policyname like 'suppliercertificates_%'
  )
order by policyname;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and (
    (tablename='companies' and policyname='companies_select_allowed')
    or (tablename='company_notifications' and policyname='company_notifications_insert_own')
  )
order by tablename, policyname;
