-- CertiTrack Phase 3C: private certificate storage + tenant-aware object policies
-- DEPLOY THE PHASE 3C FRONTEND BEFORE running this migration.
-- The Phase 3C frontend uses signed URLs and supports both legacy public URLs
-- and new object-path values already stored in file_url.

begin;


-- Supplier must be able to see the identity of companies that have saved it,
-- while a company must not discover other companies connected to the same supplier.
drop policy if exists companies_select_own on public.companies;
create policy companies_select_allowed on public.companies
for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.company_suppliers cs
    join public.suppliers s on s.id = cs.supplier_id
    where cs.company_id = companies.id
      and s.user_id = auth.uid()
  )
);

-- The current UI may create an own-company notification; scheduled service-role
-- jobs continue to bypass RLS.
create policy company_notifications_insert_own on public.company_notifications
for insert to authenticated
with check (
  exists (
    select 1 from public.companies c
    where c.id = company_notifications.company_id
      and c.user_id = auth.uid()
  )
);

-- 1) Buckets become private. Existing objects are not moved or deleted.
update storage.buckets
set public = false
where id in ('suppliercertificates', 'companycertificates');

-- 2) Remove the legacy broad policies that exposed private folders to every
-- authenticated user or made supplier certificates public.
drop policy if exists "Enable insert for authenticated users only" on storage.objects;
drop policy if exists "Give users authenticated access to folder 1fdsszd_0" on storage.objects;
drop policy if exists "Give users authenticated access to folder 1fdsszd_1" on storage.objects;
drop policy if exists "Give users authenticated access to folder 1fdsszd_2" on storage.objects;
drop policy if exists "Give users authenticated access to folder 1fdsszd_3" on storage.objects;
drop policy if exists "Give users authenticated access to folder 1iu1ll4_0" on storage.objects;
drop policy if exists "Give users authenticated access to folder 1iu1ll4_1" on storage.objects;
drop policy if exists "Give users authenticated access to folder 1iu1ll4_2" on storage.objects;
drop policy if exists "Give users authenticated access to folder 1iu1ll4_3" on storage.objects;
drop policy if exists "Public access to suppliercertificates" on storage.objects;

-- 3) Company certificate files:
-- only the authenticated owner whose auth user id is the first path segment.
create policy companycertificates_select_owner
on storage.objects for select to authenticated
using (
  bucket_id = 'companycertificates'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy companycertificates_insert_owner
on storage.objects for insert to authenticated
with check (
  bucket_id = 'companycertificates'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy companycertificates_update_owner
on storage.objects for update to authenticated
using (
  bucket_id = 'companycertificates'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'companycertificates'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy companycertificates_delete_owner
on storage.objects for delete to authenticated
using (
  bucket_id = 'companycertificates'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 4) Supplier certificate files:
-- supplier owner can always read its own folder.
-- a connected company can read only a file belonging to a non-private
-- certificate and only while the supplier has not blocked that company.
create policy suppliercertificates_select_allowed
on storage.objects for select to authenticated
using (
  bucket_id = 'suppliercertificates'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.supplier_certificates sc
      join public.company_suppliers cs on cs.supplier_id = sc.supplier_id
      join public.companies c on c.id = cs.company_id
      where c.user_id = auth.uid()
        and coalesce(cs.access, 'granted') <> 'blocked'
        and coalesce(sc.is_private, false) = false
        and (
          sc.file_url = storage.objects.name
          or sc.file_url like ('%/' || storage.objects.name)
        )
    )
  )
);

create policy suppliercertificates_insert_owner
on storage.objects for insert to authenticated
with check (
  bucket_id = 'suppliercertificates'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy suppliercertificates_update_owner
on storage.objects for update to authenticated
using (
  bucket_id = 'suppliercertificates'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'suppliercertificates'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy suppliercertificates_delete_owner
on storage.objects for delete to authenticated
using (
  bucket_id = 'suppliercertificates'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
