-- CertiTrack Phase 39 — Legacy data bridge and canonical finalization
-- Runs after Phase38. Legacy tables are read only if they exist.
-- It does NOT drop any legacy table or legacy Storage bucket.

alter table public.organizations add column if not exists legacy_company_id text;
alter table public.organizations add column if not exists legacy_supplier_id text;

alter table public.certificates add column if not exists legacy_source text;
alter table public.certificates add column if not exists legacy_id text;
alter table public.certificates add column if not exists legacy_storage_bucket text;
alter table public.certificates add column if not exists legacy_storage_ref text;

create unique index if not exists certificates_legacy_source_id_uq
on public.certificates(legacy_source,legacy_id)
where legacy_source is not null and legacy_id is not null;

-- -----------------------------------------------------------------------------
-- Companies -> organizations + owner memberships
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.companies') is not null then
    execute $sql$
      insert into public.organizations(
        legal_name,display_name,country_code,vat_number,contact_email,status,blocked,
        created_by,legacy_company_id,created_at,updated_at
      )
      select
        coalesce(nullif(trim(c.name),''),'Legacy organization'),
        coalesce(nullif(trim(c.name),''),'Legacy organization'),
        'GR',ct_normalize_vat(c.afm),c.email,
        case when coalesce(c.blocked,false) then 'suspended' else 'active' end,
        coalesce(c.blocked,false),c.user_id,c.id::text,
        coalesce(c.timestamp,now()),coalesce(c.timestamp,now())
      from public.companies c
      where nullif(ct_normalize_vat(c.afm),'') is not null
      on conflict (country_code,(ct_normalize_vat(vat_number))) where deleted_at is null
      do update set
        legal_name=coalesce(nullif(public.organizations.legal_name,''),excluded.legal_name),
        display_name=coalesce(nullif(public.organizations.display_name,''),excluded.display_name),
        contact_email=coalesce(public.organizations.contact_email,excluded.contact_email),
        legacy_company_id=excluded.legacy_company_id,
        blocked=public.organizations.blocked or excluded.blocked
    $sql$;

    execute $sql$
      insert into public.organization_members(organization_id,user_id,role,status)
      select o.id,c.user_id,'owner',
        case when coalesce(c.blocked,false) then 'suspended' else 'active' end
      from public.companies c
      join public.organizations o
        on o.country_code='GR' and ct_normalize_vat(o.vat_number)=ct_normalize_vat(c.afm)
      where c.user_id is not null
      on conflict (organization_id,user_id) do update set
        role=case when public.organization_members.role='owner' then 'owner' else excluded.role end,
        status=excluded.status,updated_at=now()
    $sql$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Suppliers -> same neutral organizations. Same VAT merges into the same entity.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.suppliers') is not null then
    execute $sql$
      insert into public.organizations(
        legal_name,display_name,country_code,vat_number,contact_email,status,blocked,
        created_by,legacy_supplier_id,created_at,updated_at
      )
      select
        coalesce(nullif(trim(s.name),''),'Legacy organization'),
        coalesce(nullif(trim(s.name),''),'Legacy organization'),
        'GR',ct_normalize_vat(s.afm),s.email,
        case when coalesce(s.blocked,false) then 'suspended' else 'active' end,
        coalesce(s.blocked,false),s.user_id,s.id::text,
        coalesce(s.timestamp,now()),coalesce(s.timestamp,now())
      from public.suppliers s
      where nullif(ct_normalize_vat(s.afm),'') is not null
      on conflict (country_code,(ct_normalize_vat(vat_number))) where deleted_at is null
      do update set
        legal_name=coalesce(nullif(public.organizations.legal_name,''),excluded.legal_name),
        display_name=coalesce(nullif(public.organizations.display_name,''),excluded.display_name),
        contact_email=coalesce(public.organizations.contact_email,excluded.contact_email),
        legacy_supplier_id=excluded.legacy_supplier_id,
        blocked=public.organizations.blocked or excluded.blocked
    $sql$;

    execute $sql$
      insert into public.organization_members(organization_id,user_id,role,status)
      select o.id,s.user_id,'owner',
        case when coalesce(s.blocked,false) then 'suspended' else 'active' end
      from public.suppliers s
      join public.organizations o
        on o.country_code='GR' and ct_normalize_vat(o.vat_number)=ct_normalize_vat(s.afm)
      where s.user_id is not null
      on conflict (organization_id,user_id) do update set
        role=case when public.organization_members.role='owner' then 'owner' else excluded.role end,
        status=excluded.status,updated_at=now()
    $sql$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Legacy certificate metadata. Files are copied separately by the controlled
-- storage migration script; old buckets remain untouched until verification.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.company_certificates') is not null then
    execute $sql$
      insert into public.certificates(
        organization_id,title,certificate_number,issuer,issue_date,expiry_date,notes,
        visibility,verification_status,created_by,updated_by,created_at,updated_at,
        legacy_source,legacy_id,legacy_storage_bucket,legacy_storage_ref
      )
      select
        o.id,coalesce(nullif(trim(c.title),''),'Πιστοποιητικό'),null,null,null,c.date,null,
        'partners',coalesce(nullif(c.verification_status,''),'pending'),
        c.company_user_id,c.company_user_id,coalesce(c.timestamp,now()),coalesce(c.timestamp,now()),
        'company_certificates',c.id::text,'companycertificates',c.file_url
      from public.company_certificates c
      join public.organizations o
        on o.legacy_company_id=c.company_id::text
        or (c.company_user_id is not null and exists(
          select 1 from public.organization_members m where m.organization_id=o.id and m.user_id=c.company_user_id
        ))
      where c.date is not null
      on conflict (legacy_source,legacy_id) where legacy_source is not null and legacy_id is not null do nothing
    $sql$;
  end if;

  if to_regclass('public.supplier_certificates') is not null then
    execute $sql$
      insert into public.certificates(
        organization_id,title,certificate_number,issuer,issue_date,expiry_date,notes,
        visibility,verification_status,created_by,updated_by,created_at,updated_at,
        legacy_source,legacy_id,legacy_storage_bucket,legacy_storage_ref
      )
      select
        o.id,coalesce(nullif(trim(c.title),''),'Πιστοποιητικό'),null,null,null,c.date,null,
        case when coalesce(c.is_private,false) then 'private' else 'partners' end,
        coalesce(nullif(c.verification_status,''),'pending'),
        c.supplier_user_id,c.supplier_user_id,coalesce(c.timestamp,now()),coalesce(c.timestamp,now()),
        'supplier_certificates',c.id::text,'suppliercertificates',c.file_url
      from public.supplier_certificates c
      join public.organizations o
        on o.legacy_supplier_id=c.supplier_id::text
        or (c.supplier_user_id is not null and exists(
          select 1 from public.organization_members m where m.organization_id=o.id and m.user_id=c.supplier_user_id
        ))
      where c.date is not null
      on conflict (legacy_source,legacy_id) where legacy_source is not null and legacy_id is not null do nothing
    $sql$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Old company/supplier links -> neutral relationships. No organization deletion.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.company_suppliers') is not null then
    execute $sql$
      insert into public.organization_relationships(
        requester_id,partner_id,status,relationship_type,requested_by,accepted_at,created_at,updated_at
      )
      select
        oc.id,os.id,
        case when coalesce(cs.access,'granted')='blocked' then 'blocked' else 'active' end,
        'partner',
        coalesce(oc.created_by,(select user_id from public.organization_members where organization_id=oc.id order by (role='owner') desc limit 1)),
        case when coalesce(cs.access,'granted')='blocked' then null else now() end,
        now(),now()
      from public.company_suppliers cs
      join public.organizations oc on oc.legacy_company_id=cs.company_id::text
      join public.organizations os on os.legacy_supplier_id=cs.supplier_id::text
      where oc.id<>os.id
        and not exists(
          select 1 from public.organization_relationships r
          where (r.requester_id=oc.id and r.partner_id=os.id)
             or (r.requester_id=os.id and r.partner_id=oc.id)
        )
    $sql$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Service-role-only helper used by the one-time legacy Storage migration.
-- -----------------------------------------------------------------------------
create or replace function public.ct_migrate_legacy_certificate_file(
  p_certificate uuid,p_storage_path text,p_original_file_name text,p_file_size_bytes bigint
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare c public.certificates; f public.certificate_files; v_version integer;
begin
  select * into c from public.certificates where id=p_certificate for update;
  if c.id is null then raise exception 'Certificate not found'; end if;
  if c.current_file_id is not null then return c.current_file_id; end if;
  if ct_storage_org_id(p_storage_path) is distinct from c.organization_id
     or ct_storage_certificate_id(p_storage_path) is distinct from c.id then
    raise exception 'Invalid canonical storage path';
  end if;
  select coalesce(max(version_no),0)+1 into v_version from public.certificate_files where certificate_id=c.id;
  insert into public.certificate_files(
    certificate_id,organization_id,version_no,storage_path,original_file_name,mime_type,file_size_bytes,uploaded_by
  ) values(
    c.id,c.organization_id,v_version,p_storage_path,coalesce(nullif(p_original_file_name,''),'certificate.pdf'),
    'application/pdf',greatest(1,p_file_size_bytes),c.created_by
  ) returning * into f;
  perform set_config('certitrack.system_write','1',true);
  update public.certificates set current_file_id=f.id,storage_path=f.storage_path,
    original_file_name=f.original_file_name,mime_type='application/pdf',file_size_bytes=f.file_size_bytes,
    updated_at=now()
  where id=c.id;
  return f.id;
end;
$$;
revoke all on function public.ct_migrate_legacy_certificate_file(uuid,text,text,bigint) from public;
grant execute on function public.ct_migrate_legacy_certificate_file(uuid,text,text,bigint) to service_role;

-- Old AFM login resolver is no longer part of authentication.
drop function if exists public.resolve_organization_login(text);

create or replace function public.organization_model_version()
returns text language sql stable security definer set search_path=public as $$ select '39'::text $$;
revoke all on function public.organization_model_version() from public;
grant execute on function public.organization_model_version() to anon,authenticated;
