-- CertiTrack Phase 35 — Certificate files, versioning and private storage hardening
-- Apply only after Phase33 canonical foundation.

-- -----------------------------------------------------------------------------
-- Certificate file versions
-- -----------------------------------------------------------------------------
create table if not exists public.certificate_files (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  storage_path text not null,
  original_file_name text not null,
  mime_type text not null default 'application/pdf' check (mime_type='application/pdf'),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 26214400),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  unique(certificate_id, version_no),
  unique(storage_path)
);

create index if not exists certificate_files_cert_idx
  on public.certificate_files(certificate_id, version_no desc);
create index if not exists certificate_files_org_idx
  on public.certificate_files(organization_id, created_at desc);

alter table public.certificates
  add column if not exists current_file_id uuid references public.certificate_files(id) on delete set null;
alter table public.certificates
  add column if not exists custom_type_label text;

-- Backfill a version row for canonical certificates that already have storage_path metadata.
insert into public.certificate_files(
  certificate_id, organization_id, version_no, storage_path,
  original_file_name, mime_type, file_size_bytes, uploaded_by, created_at
)
select c.id,c.organization_id,1,c.storage_path,
       coalesce(nullif(c.original_file_name,''),'certificate.pdf'),
       coalesce(nullif(c.mime_type,''),'application/pdf'),
       coalesce(nullif(c.file_size_bytes,0),1),
       c.created_by,coalesce(c.created_at,now())
from public.certificates c
where c.storage_path is not null
  and c.current_file_id is null
  and not exists(select 1 from public.certificate_files f where f.certificate_id=c.id)
on conflict do nothing;

update public.certificates c
set current_file_id=f.id
from public.certificate_files f
where f.certificate_id=c.id
  and c.current_file_id is null
  and f.version_no=(select max(f2.version_no) from public.certificate_files f2 where f2.certificate_id=c.id);

-- -----------------------------------------------------------------------------
-- Storage path helpers: <organization_uuid>/<certificate_uuid>/<random>.pdf
-- -----------------------------------------------------------------------------
create or replace function public.ct_storage_certificate_id(p_name text)
returns uuid language plpgsql immutable set search_path=public as $$
declare part text;
begin
  part := (storage.foldername(p_name))[2];
  if part is null or part !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return null; end if;
  return part::uuid;
exception when others then return null;
end;
$$;
grant execute on function public.ct_storage_certificate_id(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Server-controlled certificate lifecycle
-- -----------------------------------------------------------------------------
create or replace function public.ct_register_certificate_file(
  p_certificate uuid,
  p_storage_path text,
  p_original_file_name text,
  p_mime_type text,
  p_file_size_bytes bigint
)
returns public.certificate_files
language plpgsql
security definer
set search_path=public,storage
as $$
declare
  c public.certificates;
  f public.certificate_files;
  v_version integer;
begin
  select * into c from public.certificates where id=p_certificate and deleted_at is null for update;
  if c.id is null then raise exception 'Certificate not found'; end if;
  if not (ct_is_platform_admin() or ct_has_org_role(c.organization_id,array['owner','admin','member'])) then
    raise exception 'Insufficient permission';
  end if;
  if p_mime_type <> 'application/pdf' then raise exception 'Only PDF files are allowed'; end if;
  if p_file_size_bytes is null or p_file_size_bytes <= 0 or p_file_size_bytes > 26214400 then
    raise exception 'PDF size must be between 1 byte and 25 MB';
  end if;
  if ct_storage_org_id(p_storage_path) is distinct from c.organization_id
     or ct_storage_certificate_id(p_storage_path) is distinct from c.id then
    raise exception 'Invalid certificate storage path';
  end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='organizationcertificates' and o.name=p_storage_path) then
    raise exception 'Uploaded PDF object was not found';
  end if;

  select coalesce(max(version_no),0)+1 into v_version
    from public.certificate_files where certificate_id=c.id;

  update public.certificate_files
     set retired_at=coalesce(retired_at,now())
   where certificate_id=c.id and retired_at is null;

  insert into public.certificate_files(
    certificate_id,organization_id,version_no,storage_path,original_file_name,
    mime_type,file_size_bytes,uploaded_by
  ) values(
    c.id,c.organization_id,v_version,p_storage_path,
    coalesce(nullif(trim(p_original_file_name),''),'certificate.pdf'),
    p_mime_type,p_file_size_bytes,auth.uid()
  ) returning * into f;

  perform set_config('certitrack.system_write','1',true);
  update public.certificates
     set current_file_id=f.id,
         storage_path=f.storage_path,
         original_file_name=f.original_file_name,
         mime_type=f.mime_type,
         file_size_bytes=f.file_size_bytes,
         updated_by=auth.uid(),
         updated_at=now()
   where id=c.id;

  return f;
end;
$$;

create or replace function public.ct_soft_delete_certificate(p_certificate uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare c public.certificates;
begin
  select * into c from public.certificates where id=p_certificate and deleted_at is null for update;
  if c.id is null then return; end if;
  if not (ct_is_platform_admin() or ct_has_org_role(c.organization_id,array['owner','admin'])) then
    raise exception 'Only organization owners/admins may delete certificates';
  end if;
  perform set_config('certitrack.system_write','1',true);
  update public.certificates
     set deleted_at=now(),deleted_by=auth.uid(),updated_by=auth.uid(),updated_at=now()
   where id=p_certificate;
end;
$$;

create or replace function public.ct_abort_certificate_draft(p_certificate uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare c public.certificates;
begin
  select * into c from public.certificates where id=p_certificate and deleted_at is null for update;
  if c.id is null then return; end if;
  if c.current_file_id is not null then raise exception 'Certificate already has a registered file'; end if;
  if not (ct_is_platform_admin() or c.created_by=auth.uid()) then raise exception 'Insufficient permission'; end if;
  perform set_config('certitrack.system_write','1',true);
  update public.certificates
     set deleted_at=now(),deleted_by=auth.uid(),updated_by=auth.uid(),updated_at=now()
   where id=p_certificate;
end;
$$;

grant execute on function public.ct_register_certificate_file(uuid,text,text,text,bigint) to authenticated;
grant execute on function public.ct_soft_delete_certificate(uuid) to authenticated;
grant execute on function public.ct_abort_certificate_draft(uuid) to authenticated;

-- Prevent direct manipulation of deletion/ownership/current file pointers.
create or replace function public.ct_protect_certificate_system_fields()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.organization_id is distinct from old.organization_id then raise exception 'Certificate organization cannot be changed'; end if;
  if new.created_by is distinct from old.created_by then new.created_by:=old.created_by; end if;
  if new.created_at is distinct from old.created_at then new.created_at:=old.created_at; end if;

  -- Only platform admins or the controlled lifecycle functions may set system metadata.
  if not ct_is_platform_admin() and coalesce(current_setting('certitrack.system_write',true),'0') <> '1' then
    if new.deleted_at is distinct from old.deleted_at or new.deleted_by is distinct from old.deleted_by then
      raise exception 'Use the certificate delete function';
    end if;
    if new.current_file_id is distinct from old.current_file_id
       or new.storage_path is distinct from old.storage_path
       or new.original_file_name is distinct from old.original_file_name
       or new.mime_type is distinct from old.mime_type
       or new.file_size_bytes is distinct from old.file_size_bytes then
      raise exception 'Use the certificate file registration function';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ct_protect_certificate_ownership on public.certificates;
drop trigger if exists ct_protect_certificate_system_fields on public.certificates;
create trigger ct_protect_certificate_system_fields
before update on public.certificates
for each row execute procedure public.ct_protect_certificate_system_fields();

-- -----------------------------------------------------------------------------
-- Certificate file RLS
-- -----------------------------------------------------------------------------
alter table public.certificate_files enable row level security;

drop policy if exists ct_certificate_files_select on public.certificate_files;
drop policy if exists ct_certificate_files_insert on public.certificate_files;
drop policy if exists ct_certificate_files_update on public.certificate_files;
drop policy if exists ct_certificate_files_delete on public.certificate_files;

create policy ct_certificate_files_select on public.certificate_files
for select to authenticated using (
  ct_is_platform_admin()
  or ct_is_org_member(organization_id)
  or exists(
    select 1
      from public.certificates c
     where c.id=certificate_files.certificate_id
       and c.current_file_id=certificate_files.id
       and c.deleted_at is null
       and c.visibility='partners'
       and exists(
         select 1 from ct_current_org_ids() me
         where ct_has_active_relationship(me,c.organization_id)
       )
  )
);

-- File rows are registered through ct_register_certificate_file after the object upload.
-- No direct client INSERT/UPDATE/DELETE policies.

grant select on public.certificate_files to authenticated;

-- -----------------------------------------------------------------------------
-- Harden private Storage policies
-- -----------------------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('organizationcertificates','organizationcertificates',false,26214400,array['application/pdf'])
on conflict (id) do update
set public=false,file_size_limit=26214400,allowed_mime_types=array['application/pdf'];

drop policy if exists ct_storage_select on storage.objects;
drop policy if exists ct_storage_insert on storage.objects;
drop policy if exists ct_storage_update on storage.objects;
drop policy if exists ct_storage_delete on storage.objects;

create policy ct_storage_select on storage.objects
for select to authenticated using (
  bucket_id='organizationcertificates' and (
    ct_is_platform_admin()
    or (
      ct_is_org_member(ct_storage_org_id(name))
      and exists(
        select 1 from public.certificates c
        where c.id=ct_storage_certificate_id(storage.objects.name)
          and c.organization_id=ct_storage_org_id(storage.objects.name)
          and c.deleted_at is null
      )
    )
    or exists(
      select 1
      from public.certificate_files f
      join public.certificates c on c.id=f.certificate_id
      where f.storage_path=storage.objects.name
        and c.current_file_id=f.id
        and c.deleted_at is null
        and c.visibility='partners'
        and exists(
          select 1 from ct_current_org_ids() me
          where ct_has_active_relationship(me,c.organization_id)
        )
    )
  )
);

create policy ct_storage_insert on storage.objects
for insert to authenticated with check (
  bucket_id='organizationcertificates'
  and lower(storage.extension(name))='pdf'
  and ct_has_org_role(ct_storage_org_id(name),array['owner','admin','member'])
  and exists(
    select 1 from public.certificates c
    where c.id=ct_storage_certificate_id(name)
      and c.organization_id=ct_storage_org_id(name)
      and c.deleted_at is null
  )
);

-- Objects are immutable. A replacement creates a new versioned object.
-- No client UPDATE or DELETE policies; historical PDFs remain available to the owning org/audit process.

-- -----------------------------------------------------------------------------
-- Audit file version creation and certificate lifecycle
-- -----------------------------------------------------------------------------
create or replace function public.ct_audit_row_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  org uuid;
  eid text;
  oldj jsonb;
  newj jsonb;
begin
  if tg_op='INSERT' then oldj:=null; newj:=to_jsonb(new); eid:=new.id::text;
  elsif tg_op='DELETE' then oldj:=to_jsonb(old); newj:=null; eid:=old.id::text;
  else oldj:=to_jsonb(old); newj:=to_jsonb(new); eid:=new.id::text;
  end if;

  if tg_table_name='certificates' then
    org:=coalesce(nullif(newj->>'organization_id','')::uuid,nullif(oldj->>'organization_id','')::uuid);
  elsif tg_table_name='certificate_files' then
    org:=coalesce(nullif(newj->>'organization_id','')::uuid,nullif(oldj->>'organization_id','')::uuid);
  elsif tg_table_name='organization_relationships' then
    org:=coalesce(nullif(newj->>'requester_id','')::uuid,nullif(oldj->>'requester_id','')::uuid);
  elsif tg_table_name='organizations' then
    org:=eid::uuid;
  end if;

  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,old_data,new_data)
  values(org,auth.uid(),lower(tg_op),tg_table_name,eid,oldj,newj);

  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;


drop trigger if exists ct_audit_certificate_files on public.certificate_files;
create trigger ct_audit_certificate_files
after insert on public.certificate_files
for each row execute procedure public.ct_audit_row_change();

create or replace function public.organization_model_version()
returns text language sql stable security definer set search_path=public as $$ select '35'::text $$;
revoke all on function public.organization_model_version() from public;
grant execute on function public.organization_model_version() to anon,authenticated;
