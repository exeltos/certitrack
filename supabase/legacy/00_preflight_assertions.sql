-- CertiTrack Production Preflight — READ ONLY except transaction control.
-- Run immediately before the production schema.
-- This intentionally aborts if the live project is no longer in the empty-data state
-- that was verified on 2026-08-10.

begin read only;

do $$
declare n bigint;
begin
  select count(*) into n from auth.users;
  if n <> 0 then raise exception 'STOP: auth.users now contains % rows (expected 0). Re-plan deployment.',n; end if;

  select count(*) into n from public.companies;
  if n <> 0 then raise exception 'STOP: companies now contains % rows (expected 0).',n; end if;
  select count(*) into n from public.suppliers;
  if n <> 0 then raise exception 'STOP: suppliers now contains % rows (expected 0).',n; end if;
  select count(*) into n from public.company_certificates;
  if n <> 0 then raise exception 'STOP: company_certificates now contains % rows (expected 0).',n; end if;
  select count(*) into n from public.supplier_certificates;
  if n <> 0 then raise exception 'STOP: supplier_certificates now contains % rows (expected 0).',n; end if;
  select count(*) into n from public.company_suppliers;
  if n <> 0 then raise exception 'STOP: company_suppliers now contains % rows (expected 0).',n; end if;

  select count(*) into n from public.certificate_types;
  if n <> 10 then raise exception 'STOP: certificate_types contains % rows (expected 10).',n; end if;
end $$;

select code,name,requires_expiry,active
from public.certificate_types
order by code;

select b.id,b.name,b.public,b.file_size_limit,b.allowed_mime_types,
       count(o.id) as object_count
from storage.buckets b
left join storage.objects o on o.bucket_id=b.id
group by b.id,b.name,b.public,b.file_size_limit,b.allowed_mime_types
order by b.name;

rollback;
