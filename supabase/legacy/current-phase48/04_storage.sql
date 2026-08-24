-- CertiTrack private PDF storage
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('organizationcertificates','organizationcertificates',false,26214400,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=26214400,allowed_mime_types=array['application/pdf'];

drop policy if exists ct_storage_select on storage.objects;
drop policy if exists ct_storage_insert on storage.objects;
drop policy if exists ct_storage_update on storage.objects;
drop policy if exists ct_storage_delete on storage.objects;

create policy ct_storage_select on storage.objects for select to authenticated using (
 bucket_id='organizationcertificates' and (
   public.ct_is_org_member((storage.foldername(name))[1]::uuid)
   or exists(select 1 from public.certificates c where c.id=(storage.foldername(name))[2]::uuid and c.organization_id=(storage.foldername(name))[1]::uuid and c.visibility='partners' and c.deleted_at is null and exists(select 1 from public.organization_relationships r where r.status='active' and ((r.requester_organization_id=c.organization_id and r.partner_organization_id in(select public.ct_current_org_ids())) or (r.partner_organization_id=c.organization_id and r.requester_organization_id in(select public.ct_current_org_ids())))))
 )
);
create policy ct_storage_insert on storage.objects for insert to authenticated with check(bucket_id='organizationcertificates' and public.ct_is_org_member((storage.foldername(name))[1]::uuid));
create policy ct_storage_update on storage.objects for update to authenticated using(bucket_id='organizationcertificates' and public.ct_is_org_member((storage.foldername(name))[1]::uuid)) with check(bucket_id='organizationcertificates' and public.ct_is_org_member((storage.foldername(name))[1]::uuid));
create policy ct_storage_delete on storage.objects for delete to authenticated using(bucket_id='organizationcertificates' and public.ct_has_org_role((storage.foldername(name))[1]::uuid,array['owner','admin']));
commit;
