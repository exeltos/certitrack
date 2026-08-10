-- CertiTrack Phase 27 — Unified Organization Model
-- Run in Supabase SQL Editor after taking a database backup.
-- This migration is additive: legacy tables remain untouched for rollback/compatibility.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  afm text not null unique,
  email text,
  blocked boolean not null default false,
  status text not null default 'active',
  legacy_company_id text,
  legacy_supplier_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  type text,
  date date not null,
  file_url text,
  name text,
  is_private boolean not null default false,
  verification_status text default 'pending',
  legacy_source text,
  legacy_id text,
  timestamp timestamptz not null default now(),
  unique (legacy_source, legacy_id)
);

create table if not exists public.organization_relationships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.organizations(id) on delete cascade,
  partner_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','active','rejected','blocked','inactive')),
  relationship_type text not null default 'partner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> partner_id),
  unique (requester_id, partner_id)
);

-- Companies become organizations.
insert into public.organizations (user_id,name,afm,email,blocked,status,legacy_company_id)
select c.user_id,c.name,c.afm,c.email,coalesce(c.blocked,false),'active',c.id::text
from public.companies c
where nullif(trim(c.afm),'') is not null
on conflict (afm) do update set
  name=excluded.name,
  email=coalesce(public.organizations.email,excluded.email),
  user_id=coalesce(public.organizations.user_id,excluded.user_id),
  legacy_company_id=excluded.legacy_company_id,
  blocked=public.organizations.blocked or excluded.blocked;

-- Suppliers are merged by AFM when the same legal entity already exists.
insert into public.organizations (user_id,name,afm,email,blocked,status,legacy_supplier_id)
select s.user_id,s.name,s.afm,s.email,coalesce(s.blocked,false),coalesce(nullif(lower(s.status),''),'active'),s.id::text
from public.suppliers s
where nullif(trim(s.afm),'') is not null
on conflict (afm) do update set
  name=coalesce(public.organizations.name,excluded.name),
  email=coalesce(public.organizations.email,excluded.email),
  user_id=coalesce(public.organizations.user_id,excluded.user_id),
  legacy_supplier_id=excluded.legacy_supplier_id,
  blocked=public.organizations.blocked or excluded.blocked;

-- Legacy company certificates.
insert into public.certificates (organization_id,owner_user_id,title,type,date,file_url,name,is_private,verification_status,legacy_source,legacy_id,timestamp)
select o.id,c.company_user_id,c.title,c.type,c.date,c.file_url,c.name,false,coalesce(c.verification_status,'pending'),'company_certificates',c.id::text,coalesce(c.timestamp,now())
from public.company_certificates c
join public.organizations o on o.legacy_company_id=c.company_id::text or (o.user_id=c.company_user_id and c.company_user_id is not null)
where c.date is not null
on conflict (legacy_source,legacy_id) do nothing;

-- Legacy supplier certificates.
insert into public.certificates (organization_id,owner_user_id,title,type,date,file_url,name,is_private,verification_status,legacy_source,legacy_id,timestamp)
select o.id,c.supplier_user_id,c.title,c.type,c.date,c.file_url,c.name,coalesce(c.is_private,false),coalesce(c.verification_status,'pending'),'supplier_certificates',c.id::text,coalesce(c.timestamp,now())
from public.supplier_certificates c
join public.organizations o on o.legacy_supplier_id=c.supplier_id::text or (o.user_id=c.supplier_user_id and c.supplier_user_id is not null)
where c.date is not null
on conflict (legacy_source,legacy_id) do nothing;

-- Existing company-supplier links become neutral organization relationships.
insert into public.organization_relationships (requester_id,partner_id,status,relationship_type)
select oc.id,os.id,
  case when coalesce(cs.access,'granted')='blocked' then 'blocked' else 'active' end,
  'partner'
from public.company_suppliers cs
join public.organizations oc on oc.legacy_company_id=cs.company_id::text
join public.organizations os on os.legacy_supplier_id=cs.supplier_id::text
where oc.id<>os.id
on conflict (requester_id,partner_id) do update set status=excluded.status;

-- RLS
alter table public.organizations enable row level security;
alter table public.certificates enable row level security;
alter table public.organization_relationships enable row level security;

drop policy if exists "organizations_read_related" on public.organizations;
create policy "organizations_read_related" on public.organizations for select to authenticated using (
  user_id=auth.uid() or exists (
    select 1 from public.organization_relationships r
    join public.organizations me on me.user_id=auth.uid()
    where r.status='active' and ((r.requester_id=me.id and r.partner_id=organizations.id) or (r.partner_id=me.id and r.requester_id=organizations.id))
  )
);

drop policy if exists "organizations_update_own" on public.organizations;
create policy "organizations_update_own" on public.organizations for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists "organizations_insert_own" on public.organizations;
create policy "organizations_insert_own" on public.organizations for insert to authenticated with check (user_id=auth.uid());

drop policy if exists "certificates_read_owner_or_partner" on public.certificates;
create policy "certificates_read_owner_or_partner" on public.certificates for select to authenticated using (
  exists (select 1 from public.organizations o where o.id=organization_id and o.user_id=auth.uid())
  or (
    is_private=false and exists (
      select 1 from public.organization_relationships r
      join public.organizations me on me.user_id=auth.uid()
      where r.status='active' and ((r.requester_id=me.id and r.partner_id=certificates.organization_id) or (r.partner_id=me.id and r.requester_id=certificates.organization_id))
    )
  )
);

drop policy if exists "certificates_owner_write" on public.certificates;
create policy "certificates_owner_write" on public.certificates for all to authenticated using (
  exists (select 1 from public.organizations o where o.id=organization_id and o.user_id=auth.uid())
) with check (
  exists (select 1 from public.organizations o where o.id=organization_id and o.user_id=auth.uid())
);

drop policy if exists "relationships_read_member" on public.organization_relationships;
create policy "relationships_read_member" on public.organization_relationships for select to authenticated using (
  exists (select 1 from public.organizations o where o.user_id=auth.uid() and o.id in (requester_id,partner_id))
);

drop policy if exists "relationships_create_requester" on public.organization_relationships;
create policy "relationships_create_requester" on public.organization_relationships for insert to authenticated with check (
  exists (select 1 from public.organizations o where o.user_id=auth.uid() and o.id=requester_id)
);

drop policy if exists "relationships_update_member" on public.organization_relationships;
create policy "relationships_update_member" on public.organization_relationships for update to authenticated using (
  exists (select 1 from public.organizations o where o.user_id=auth.uid() and o.id in (requester_id,partner_id))
) with check (
  exists (
    select 1 from public.organizations o
    where o.user_id=auth.uid()
      and (
        (organization_relationships.status='active' and o.id=organization_relationships.partner_id)
        or (organization_relationships.status in ('pending','rejected','blocked','inactive') and o.id in (organization_relationships.requester_id,organization_relationships.partner_id))
      )
  )
);

drop policy if exists "relationships_delete_member" on public.organization_relationships;
create policy "relationships_delete_member" on public.organization_relationships for delete to authenticated using (
  exists (select 1 from public.organizations o where o.user_id=auth.uid() and o.id in (requester_id,partner_id))
);

-- New private storage bucket. Existing legacy buckets are intentionally preserved.
insert into storage.buckets (id,name,public) values ('organizationcertificates','organizationcertificates',false)
on conflict (id) do update set public=false;

drop policy if exists "organization_certificates_storage_read" on storage.objects;
create policy "organization_certificates_storage_read" on storage.objects for select to authenticated using (
  bucket_id='organizationcertificates' and (
    (storage.foldername(name))[1]=auth.uid()::text
    or exists (
      select 1
      from public.certificates c
      join public.organizations owner_org on owner_org.id=c.organization_id
      join public.organizations me on me.user_id=auth.uid()
      join public.organization_relationships r on r.status='active' and ((r.requester_id=me.id and r.partner_id=owner_org.id) or (r.partner_id=me.id and r.requester_id=owner_org.id))
      where c.is_private=false and c.file_url=objects.name
    )
  )
);

drop policy if exists "organization_certificates_storage_insert" on storage.objects;
create policy "organization_certificates_storage_insert" on storage.objects for insert to authenticated with check (bucket_id='organizationcertificates' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "organization_certificates_storage_update" on storage.objects;
create policy "organization_certificates_storage_update" on storage.objects for update to authenticated using (bucket_id='organizationcertificates' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "organization_certificates_storage_delete" on storage.objects;
create policy "organization_certificates_storage_delete" on storage.objects for delete to authenticated using (bucket_id='organizationcertificates' and (storage.foldername(name))[1]=auth.uid()::text);

-- Lightweight schema capability probe for the transitional frontend.
create or replace function public.organization_model_version()
returns text language sql stable security definer set search_path=public as $$ select '28'::text $$;
grant execute on function public.organization_model_version() to anon, authenticated;

-- Login resolver: keeps table RLS strict while supporting the existing AFM login UX.
create or replace function public.resolve_organization_login(lookup_afm text)
returns table(id uuid,name text,afm text,email text,blocked boolean,status text)
language sql stable security definer set search_path=public as $$
  select o.id,o.name,o.afm,o.email,o.blocked,o.status
  from public.organizations o
  where o.afm=trim(lookup_afm)
  limit 1
$$;
grant execute on function public.resolve_organization_login(text) to anon, authenticated;

-- Authenticated partner lookup exposes only the directory fields needed to request a relationship.
create or replace function public.find_organization_partner(search_value text)
returns table(id uuid,name text,afm text,email text,user_id uuid)
language sql stable security definer set search_path=public as $$
  select o.id,o.name,o.afm,o.email,o.user_id
  from public.organizations o
  where auth.uid() is not null
    and (o.afm=trim(search_value) or lower(o.email)=lower(trim(search_value)))
  limit 1
$$;
grant execute on function public.find_organization_partner(text) to authenticated;

-- New organization profiles are created from auth metadata. This avoids anonymous INSERT policies.
create or replace function public.handle_new_organization_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce(new.raw_user_meta_data->>'type','')='organization' then
    insert into public.organizations(user_id,name,afm,email,status)
    values(new.id,coalesce(new.raw_user_meta_data->>'name',new.email),new.raw_user_meta_data->>'afm',new.email,'active')
    on conflict (afm) do update set
      user_id=coalesce(public.organizations.user_id,excluded.user_id),
      email=coalesce(public.organizations.email,excluded.email),
      name=coalesce(public.organizations.name,excluded.name);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_certitrack_org on auth.users;
create trigger on_auth_user_created_certitrack_org
after insert on auth.users for each row execute procedure public.handle_new_organization_user();
