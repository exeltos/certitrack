-- CertiTrack Production Supabase Schema v1
-- Target project: klutmusrabsizqjnzwpu
-- Prepared from read-only preflight on 2026-08-10.
--
-- IMPORTANT:
-- * Existing legacy tables are NOT dropped.
-- * Existing 10 certificate_types are preserved and upgraded.
-- * Existing public legacy Storage buckets are NOT dropped.
-- * Current database has 0 auth users / organizations / legacy certificates.
-- * Run 00_preflight_assertions.sql immediately before this file.
--
begin;

-- CertiTrack Phase 33 — Backend Foundation
-- Canonical Organization-based schema. Designed to be deployed through Supabase migrations.
-- IMPORTANT: Do not run manually in production before the Phase 33 preflight/backup step.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.ct_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.ct_normalize_vat(value text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select upper(regexp_replace(trim(value), '[^A-Za-z0-9]', '', 'g'))
$$;

-- -----------------------------------------------------------------------------
-- Organizations and memberships
-- -----------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  display_name text,
  country_code text not null default 'GR' check (country_code ~ '^[A-Z]{2}$'),
  vat_number text not null,
  contact_email text,
  phone text,
  website text,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  status text not null default 'pending_verification'
    check (status in ('pending_verification','active','suspended','closure_requested','closed')),
  blocked boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  deleted_at timestamptz,
  constraint organizations_vat_not_blank check (length(ct_normalize_vat(vat_number)) > 0),
  constraint organizations_gr_vat_format check (country_code <> 'GR' or ct_normalize_vat(vat_number) ~ '^[0-9]{9}$')
);

-- Backfill/compatibility when the Phase 28 table already exists.
alter table public.organizations add column if not exists legal_name text;
alter table public.organizations add column if not exists display_name text;
alter table public.organizations add column if not exists country_code text default 'GR';
alter table public.organizations add column if not exists vat_number text;
alter table public.organizations add column if not exists contact_email text;
alter table public.organizations add column if not exists phone text;
alter table public.organizations add column if not exists website text;
alter table public.organizations add column if not exists address_line1 text;
alter table public.organizations add column if not exists address_line2 text;
alter table public.organizations add column if not exists city text;
alter table public.organizations add column if not exists postal_code text;
alter table public.organizations add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.organizations add column if not exists closed_at timestamptz;
alter table public.organizations add column if not exists deleted_at timestamptz;

-- Copy Phase 28 compatibility fields only when those columns actually exist.
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='organizations' and column_name='name') then
    execute 'update public.organizations set legal_name=coalesce(nullif(legal_name,'''') ,nullif(name,'''')), display_name=coalesce(nullif(display_name,'''') ,nullif(name,'''')) where legal_name is null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='organizations' and column_name='afm') then
    execute 'update public.organizations set vat_number=coalesce(nullif(vat_number,'''') ,nullif(afm,'''')) where vat_number is null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='organizations' and column_name='email') then
    execute 'update public.organizations set contact_email=coalesce(nullif(contact_email,'''') ,nullif(email,'''')) where contact_email is null';
  end if;
end $$;

create unique index if not exists organizations_country_vat_uq
  on public.organizations (country_code, ct_normalize_vat(vat_number))
  where deleted_at is null;
create index if not exists organizations_status_idx on public.organizations(status) where deleted_at is null;

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  status text not null default 'active' check (status in ('pending_verification','active','suspended','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (organization_id, user_id)
);
create index if not exists organization_members_user_idx on public.organization_members(user_id, status);
create index if not exists organization_members_org_idx on public.organization_members(organization_id, status);

-- Convert Phase 28 one-user-per-org ownership when the legacy user_id column exists.
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='organizations' and column_name='user_id') then
    execute $sql$insert into public.organization_members(organization_id,user_id,role,status)
      select id,user_id,'owner',case when status='pending_verification' then 'pending_verification' else 'active' end
      from public.organizations where user_id is not null
      on conflict (organization_id,user_id) do nothing$sql$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Certificate catalogue and certificates
-- -----------------------------------------------------------------------------
create table if not exists public.certificate_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text,
  requires_expiry boolean not null default true,
  name_el text,
  name_en text,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Production compatibility: the live project already has certificate_types
-- with columns (id, code, name, requires_expiry, active, created_at).
alter table public.certificate_types add column if not exists name_el text;
alter table public.certificate_types add column if not exists name_en text;
alter table public.certificate_types add column if not exists sort_order integer not null default 100;
alter table public.certificate_types add column if not exists updated_at timestamptz not null default now();

update public.certificate_types
set name_el=coalesce(name_el,name,code),
    name_en=coalesce(name_en,
      case code
        when 'INSURANCE' then 'Insurance'
        when 'INSURANCE_CLEARANCE' then 'Social Security Clearance'
        when 'OPERATING_LICENSE' then 'Operating License'
        when 'TAX_CLEARANCE' then 'Tax Clearance'
        else coalesce(name,code)
      end)
where name_el is null or name_en is null;

alter table public.certificate_types alter column name_el set not null;
alter table public.certificate_types alter column name_en set not null;

insert into public.certificate_types(code,name,requires_expiry,name_el,name_en,sort_order) values
  ('ISO9001','ISO 9001',true,'ISO 9001','ISO 9001',10),
  ('ISO13485','ISO 13485',true,'ISO 13485','ISO 13485',20),
  ('ISO14001','ISO 14001',true,'ISO 14001','ISO 14001',30),
  ('ISO27001','ISO 27001',true,'ISO 27001','ISO 27001',40),
  ('ISO45001','ISO 45001',true,'ISO 45001','ISO 45001',50),
  ('CE','CE',true,'Πιστοποιητικό CE','CE Certificate',60),
  ('OPERATING_LICENSE','Άδεια λειτουργίας',true,'Άδεια Λειτουργίας','Operating License',70),
  ('OTHER','Άλλο',true,'Άλλο','Other',999)
on conflict (code) do update set
  name_el=excluded.name_el,
  name_en=excluded.name_en,
  sort_order=excluded.sort_order,
  updated_at=now();

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  certificate_type_id uuid references public.certificate_types(id) on delete set null,
  certificate_number text,
  issuer text,
  issue_date date,
  expiry_date date,
  notes text,
  visibility text not null default 'partners' check (visibility in ('private','partners')),
  verification_status text not null default 'pending',
  storage_path text,
  original_file_name text,
  mime_type text,
  file_size_bytes bigint,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

-- Canonical certificate columns. Existing legacy columns are preserved during migration.
alter table public.certificates add column if not exists certificate_type_id uuid references public.certificate_types(id) on delete set null;
alter table public.certificates add column if not exists certificate_number text;
alter table public.certificates add column if not exists issuer text;
alter table public.certificates add column if not exists issue_date date;
alter table public.certificates add column if not exists expiry_date date;
alter table public.certificates add column if not exists notes text;
alter table public.certificates add column if not exists visibility text default 'partners';
alter table public.certificates add column if not exists storage_path text;
alter table public.certificates add column if not exists original_file_name text;
alter table public.certificates add column if not exists mime_type text;
alter table public.certificates add column if not exists file_size_bytes bigint;
alter table public.certificates add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.certificates add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.certificates add column if not exists created_at timestamptz default now();
alter table public.certificates add column if not exists updated_at timestamptz default now();
alter table public.certificates add column if not exists deleted_at timestamptz;
alter table public.certificates add column if not exists deleted_by uuid references auth.users(id) on delete set null;

-- Map Phase 28/31 fields into canonical fields only when legacy columns exist.
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='certificates' and column_name='date') then execute 'update public.certificates set expiry_date=coalesce(expiry_date,date)'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='certificates' and column_name='is_private') then execute 'update public.certificates set visibility=case when coalesce(is_private,false) then ''private'' else coalesce(nullif(visibility,''''),''partners'') end'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='certificates' and column_name='file_url') then execute 'update public.certificates set storage_path=coalesce(storage_path,file_url)'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='certificates' and column_name='name') then execute 'update public.certificates set original_file_name=coalesce(original_file_name,name)'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='certificates' and column_name='owner_user_id') then execute 'update public.certificates set created_by=coalesce(created_by,owner_user_id),updated_by=coalesce(updated_by,owner_user_id)'; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='certificates' and column_name='timestamp') then execute 'update public.certificates set created_at=coalesce(created_at,timestamp,now()),updated_at=coalesce(updated_at,timestamp,now())'; end if;
end $$;

-- Constrain canonical values after backfill.
do $$
begin
  if not exists (select 1 from pg_constraint where conname='certificates_visibility_check') then
    alter table public.certificates add constraint certificates_visibility_check check (visibility in ('private','partners'));
  end if;
  if not exists (select 1 from pg_constraint where conname='certificates_dates_check') then
    alter table public.certificates add constraint certificates_dates_check check (issue_date is null or expiry_date is null or expiry_date >= issue_date);
  end if;
  if not exists (select 1 from pg_constraint where conname='certificates_file_size_check') then
    alter table public.certificates add constraint certificates_file_size_check check (file_size_bytes is null or (file_size_bytes > 0 and file_size_bytes <= 26214400));
  end if;
end $$;

create index if not exists certificates_org_expiry_active_idx on public.certificates(organization_id, expiry_date) where deleted_at is null;
create index if not exists certificates_org_visibility_idx on public.certificates(organization_id, visibility) where deleted_at is null;
create index if not exists certificates_type_idx on public.certificates(certificate_type_id) where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Organization relationships. Relationships are ended, never hard-deleted by users.
-- -----------------------------------------------------------------------------
create table if not exists public.relationship_invitations (
  id uuid primary key default gen_random_uuid(),
  requester_organization_id uuid not null references public.organizations(id) on delete cascade,
  target_organization_id uuid references public.organizations(id) on delete cascade,
  invitee_email text,
  invitee_country_code text default 'GR',
  invitee_vat_number text,
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired','cancelled')),
  token_hash text,
  requested_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '14 days'),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_organization_id is not null or invitee_email is not null or invitee_vat_number is not null)
);
create index if not exists relationship_invitations_requester_idx on public.relationship_invitations(requester_organization_id,status);
create index if not exists relationship_invitations_target_idx on public.relationship_invitations(target_organization_id,status);
create index if not exists relationship_invitations_email_idx on public.relationship_invitations(lower(invitee_email)) where invitee_email is not null;

create table if not exists public.organization_relationships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.organizations(id) on delete cascade,
  partner_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'pending',
  relationship_type text not null default 'partner',
  requested_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  ended_by uuid references auth.users(id) on delete set null,
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> partner_id)
);

-- Upgrade Phase 28 relationships to retain lifecycle history.
alter table public.organization_relationships add column if not exists requested_by uuid references auth.users(id) on delete set null;
alter table public.organization_relationships add column if not exists accepted_by uuid references auth.users(id) on delete set null;
alter table public.organization_relationships add column if not exists accepted_at timestamptz;
alter table public.organization_relationships add column if not exists ended_by uuid references auth.users(id) on delete set null;
alter table public.organization_relationships add column if not exists ended_at timestamptz;
alter table public.organization_relationships add column if not exists end_reason text;

-- Replace the old status constraint if present.
do $$
declare c_name text;
begin
  select conname into c_name
  from pg_constraint
  where conrelid='public.organization_relationships'::regclass
    and contype='c'
    and pg_get_constraintdef(oid) ilike '%status%';
  if c_name is not null then execute format('alter table public.organization_relationships drop constraint %I', c_name); end if;
exception when others then null;
end $$;

-- Normalize historical status names before validating the new constraint.
update public.organization_relationships set status='declined' where status='rejected';
update public.organization_relationships set status='ended' where status='inactive';
do $$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.organization_relationships'::regclass and conname='organization_relationships_status_v33_check') then
    alter table public.organization_relationships add constraint organization_relationships_status_v33_check check (status in ('pending','active','declined','ended','blocked')) not valid;
  end if;
end $$;
alter table public.organization_relationships validate constraint organization_relationships_status_v33_check;

-- Prevent duplicate relationship pairs in either direction among non-ended relationships.
create unique index if not exists organization_relationships_active_pair_uq
on public.organization_relationships (
  least(requester_id::text, partner_id::text),
  greatest(requester_id::text, partner_id::text)
)
where status in ('pending','active','blocked');
create index if not exists organization_relationships_requester_idx on public.organization_relationships(requester_id,status);
create index if not exists organization_relationships_partner_idx on public.organization_relationships(partner_id,status);

-- -----------------------------------------------------------------------------
-- Notifications and preferences
-- -----------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  expiry_warning_days integer[] not null default array[90,60,30,15,7,0],
  relationship_notifications boolean not null default true,
  certificate_change_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,user_id),
  check (expiry_warning_days <@ array[0,1,3,7,14,15,30,45,60,90,120,180,365])
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('certificate_expiry','certificate_expired','relationship_invite','relationship_accepted','relationship_declined','certificate_changed','system')),
  severity text not null default 'info' check (severity in ('info','warning','critical','success')),
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists notifications_dedupe_uq on public.notifications(user_id,dedupe_key) where dedupe_key is not null;
create index if not exists notifications_user_unread_idx on public.notifications(user_id,created_at desc) where read_at is null;

-- -----------------------------------------------------------------------------
-- Immutable audit trail
-- -----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Production compatibility: preserve the existing empty legacy audit_log
-- and extend it to the canonical append-only shape.
alter table public.audit_log add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table public.audit_log add column if not exists old_data jsonb;
alter table public.audit_log add column if not exists new_data jsonb;
alter table public.audit_log add column if not exists metadata jsonb not null default '{}'::jsonb;
-- The live audit_log.id already has its own identity/sequence lifecycle.
-- Do not recreate, re-own or replace that sequence during the in-place upgrade.

create index if not exists audit_log_org_time_idx on public.audit_log(organization_id,created_at desc);
create index if not exists audit_log_actor_time_idx on public.audit_log(actor_user_id,created_at desc);

-- Optional explicit platform-admin allowlist. It does not replace Supabase service-role security.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- -----------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER prevents RLS recursion)
-- -----------------------------------------------------------------------------
create or replace function public.ct_is_platform_admin(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.platform_admins a where a.user_id=p_user)
$$;

create or replace function public.ct_is_org_member(p_org uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.organization_members m
    where m.organization_id=p_org and m.user_id=p_user and m.status='active'
  )
$$;

create or replace function public.ct_has_org_role(p_org uuid, p_roles text[], p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.organization_members m
    where m.organization_id=p_org and m.user_id=p_user and m.status='active' and m.role=any(p_roles)
  )
$$;

create or replace function public.ct_has_active_relationship(p_org_a uuid, p_org_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.organization_relationships r
    where r.status='active'
      and ((r.requester_id=p_org_a and r.partner_id=p_org_b) or (r.requester_id=p_org_b and r.partner_id=p_org_a))
  )
$$;

create or replace function public.ct_current_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.organization_members where user_id=auth.uid() and status='active'
$$;

revoke all on function public.ct_is_platform_admin(uuid) from public;
revoke all on function public.ct_is_org_member(uuid,uuid) from public;
revoke all on function public.ct_has_org_role(uuid,text[],uuid) from public;
revoke all on function public.ct_has_active_relationship(uuid,uuid) from public;
revoke all on function public.ct_current_org_ids() from public;
grant execute on function public.ct_is_platform_admin(uuid) to authenticated;
grant execute on function public.ct_is_org_member(uuid,uuid) to authenticated;
grant execute on function public.ct_has_org_role(uuid,text[],uuid) to authenticated;
grant execute on function public.ct_has_active_relationship(uuid,uuid) to authenticated;
grant execute on function public.ct_current_org_ids() to authenticated;

-- -----------------------------------------------------------------------------
-- Relationship RPCs: status transitions are server controlled.
-- -----------------------------------------------------------------------------
create or replace function public.ct_request_relationship(p_requester_org uuid, p_target_org uuid)
returns public.organization_relationships
language plpgsql
security definer
set search_path = public
as $$
declare result public.organization_relationships;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_requester_org=p_target_org then raise exception 'Cannot relate an organization to itself'; end if;
  if not ct_has_org_role(p_requester_org,array['owner','admin','member']) then raise exception 'Insufficient permission'; end if;
  if not exists(select 1 from organizations where id=p_target_org and status='active' and deleted_at is null) then raise exception 'Target organization unavailable'; end if;
  if exists(select 1 from organization_relationships r where r.status in ('pending','active','blocked') and ((r.requester_id=p_requester_org and r.partner_id=p_target_org) or (r.requester_id=p_target_org and r.partner_id=p_requester_org))) then
    raise exception 'Relationship already exists or is pending';
  end if;
  insert into organization_relationships(requester_id,partner_id,status,relationship_type,requested_by)
  values(p_requester_org,p_target_org,'pending','partner',auth.uid()) returning * into result;
  return result;
end;
$$;

create or replace function public.ct_respond_relationship(p_relationship uuid, p_accept boolean)
returns public.organization_relationships
language plpgsql
security definer
set search_path = public
as $$
declare r public.organization_relationships;
begin
  select * into r from organization_relationships where id=p_relationship for update;
  if r.id is null then raise exception 'Relationship not found'; end if;
  if r.status <> 'pending' then raise exception 'Relationship is not pending'; end if;
  if not ct_has_org_role(r.partner_id,array['owner','admin']) then raise exception 'Only the invited organization owner/admin may respond'; end if;
  update organization_relationships
    set status=case when p_accept then 'active' else 'declined' end,
        accepted_by=case when p_accept then auth.uid() else null end,
        accepted_at=case when p_accept then now() else null end,
        updated_at=now()
  where id=p_relationship returning * into r;
  return r;
end;
$$;

create or replace function public.ct_end_relationship(p_relationship uuid, p_reason text default null)
returns public.organization_relationships
language plpgsql
security definer
set search_path = public
as $$
declare r public.organization_relationships;
begin
  select * into r from organization_relationships where id=p_relationship for update;
  if r.id is null then raise exception 'Relationship not found'; end if;
  if not (ct_has_org_role(r.requester_id,array['owner','admin']) or ct_has_org_role(r.partner_id,array['owner','admin'])) then raise exception 'Insufficient permission'; end if;
  if r.status not in ('active','pending') then raise exception 'Relationship cannot be ended from current status'; end if;
  update organization_relationships
    set status='ended',ended_by=auth.uid(),ended_at=now(),end_reason=nullif(trim(p_reason),''),updated_at=now()
  where id=p_relationship returning * into r;
  return r;
end;
$$;

grant execute on function public.ct_request_relationship(uuid,uuid) to authenticated;
grant execute on function public.ct_respond_relationship(uuid,boolean) to authenticated;
grant execute on function public.ct_end_relationship(uuid,text) to authenticated;

-- -----------------------------------------------------------------------------
-- Registration bootstrap and verified-email activation
-- -----------------------------------------------------------------------------
create or replace function public.ct_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_country text := upper(coalesce(nullif(new.raw_user_meta_data->>'country_code',''),'GR'));
  v_vat text := ct_normalize_vat(new.raw_user_meta_data->>'afm');
  v_name text := nullif(trim(new.raw_user_meta_data->>'name'),'');
begin
  if coalesce(new.raw_user_meta_data->>'type','') <> 'organization' then return new; end if;
  if v_name is null or v_vat is null then raise exception 'Organization name and VAT number are required'; end if;

  insert into organizations(legal_name,display_name,country_code,vat_number,contact_email,status,created_by)
  values(v_name,v_name,v_country,v_vat,new.email,
         case when new.email_confirmed_at is null then 'pending_verification' else 'active' end,new.id)
  returning id into v_org;

  insert into organization_members(organization_id,user_id,role,status)
  values(v_org,new.id,'owner',case when new.email_confirmed_at is null then 'pending_verification' else 'active' end);

  insert into notification_preferences(organization_id,user_id) values(v_org,new.id)
  on conflict (organization_id,user_id) do nothing;
  return new;
exception
  when unique_violation then
    raise exception 'An organization with this VAT number already exists';
end;
$$;

create or replace function public.ct_handle_auth_user_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update organization_members set status='active',updated_at=now()
      where user_id=new.id and status='pending_verification';
    update organizations o set status='active',updated_at=now()
      where o.status='pending_verification'
        and exists(select 1 from organization_members m where m.organization_id=o.id and m.user_id=new.id and m.role='owner');
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_certitrack_org on auth.users;
drop trigger if exists ct_on_auth_user_created on auth.users;
create trigger ct_on_auth_user_created after insert on auth.users
for each row execute procedure public.ct_handle_new_auth_user();

drop trigger if exists ct_on_auth_user_verified on auth.users;
create trigger ct_on_auth_user_verified after update of email_confirmed_at on auth.users
for each row execute procedure public.ct_handle_auth_user_verified();

-- -----------------------------------------------------------------------------
-- Generic audit triggers for core entities
-- -----------------------------------------------------------------------------
create or replace function public.ct_audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare org uuid; eid text; oldj jsonb; newj jsonb;
begin
  if tg_op='INSERT' then oldj:=null; newj:=to_jsonb(new); eid:=new.id::text;
  elsif tg_op='DELETE' then oldj:=to_jsonb(old); newj:=null; eid:=old.id::text;
  else oldj:=to_jsonb(old); newj:=to_jsonb(new); eid:=new.id::text; end if;

  if tg_table_name='certificates' then org := coalesce((newj->>'organization_id')::uuid,(oldj->>'organization_id')::uuid);
  elsif tg_table_name='organization_relationships' then org := coalesce((newj->>'requester_id')::uuid,(oldj->>'requester_id')::uuid);
  elsif tg_table_name='organizations' then org := eid::uuid;
  end if;

  insert into audit_log(organization_id,actor_user_id,action,entity_type,entity_id,old_data,new_data)
  values(org,auth.uid(),lower(tg_op),tg_table_name,eid,oldj,newj);
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;

-- Prevent tenant ownership from being moved by a normal certificate UPDATE.
create or replace function public.ct_protect_certificate_ownership()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.organization_id is distinct from old.organization_id then raise exception 'Certificate organization cannot be changed'; end if;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;
drop trigger if exists ct_protect_certificate_ownership on public.certificates;
create trigger ct_protect_certificate_ownership before update on public.certificates
for each row execute procedure public.ct_protect_certificate_ownership();

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['organizations','organization_members','certificate_types','certificates','organization_relationships','relationship_invitations','notification_preferences'] loop
    execute format('drop trigger if exists ct_touch_updated_at on public.%I',t);
    execute format('create trigger ct_touch_updated_at before update on public.%I for each row execute procedure public.ct_touch_updated_at()',t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.certificate_types enable row level security;
alter table public.certificates enable row level security;
alter table public.organization_relationships enable row level security;
alter table public.relationship_invitations enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;
alter table public.platform_admins enable row level security;

-- The live project reuses two legacy tables in-place. Remove their old policies
-- before applying the canonical policies; RLS policies are OR-combined.
do $$
declare p record;
begin
  for p in
    select schemaname,tablename,policyname
    from pg_policies
    where schemaname='public' and tablename in ('certificate_types','audit_log')
  loop
    execute format('drop policy if exists %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  end loop;
end $$;

-- Drop known old Phase 28 policies so there is one canonical authorization model.
drop policy if exists "organizations_read_related" on public.organizations;
drop policy if exists "organizations_update_own" on public.organizations;
drop policy if exists "organizations_insert_own" on public.organizations;
drop policy if exists "certificates_read_owner_or_partner" on public.certificates;
drop policy if exists "certificates_owner_write" on public.certificates;
drop policy if exists "relationships_read_member" on public.organization_relationships;
drop policy if exists "relationships_create_requester" on public.organization_relationships;
drop policy if exists "relationships_update_member" on public.organization_relationships;
drop policy if exists "relationships_delete_member" on public.organization_relationships;

drop policy if exists ct_organizations_select on public.organizations;
create policy ct_organizations_select on public.organizations
for select to authenticated using (
  deleted_at is null and (
    ct_is_platform_admin() or ct_is_org_member(id) or exists(
      select 1 from ct_current_org_ids() me where ct_has_active_relationship(me,organizations.id)
    )
  )
);
drop policy if exists ct_organizations_update on public.organizations;
create policy ct_organizations_update on public.organizations
for update to authenticated using (ct_is_platform_admin() or ct_has_org_role(id,array['owner','admin']))
with check (ct_is_platform_admin() or ct_has_org_role(id,array['owner','admin']));

drop policy if exists ct_members_select on public.organization_members;
create policy ct_members_select on public.organization_members
for select to authenticated using (ct_is_platform_admin() or ct_is_org_member(organization_id));
drop policy if exists ct_certificate_types_select on public.certificate_types;
create policy ct_certificate_types_select on public.certificate_types
for select to authenticated using (active=true or ct_is_platform_admin());

drop policy if exists ct_certificates_select on public.certificates;
create policy ct_certificates_select on public.certificates
for select to authenticated using (
  deleted_at is null and (
    ct_is_platform_admin() or ct_is_org_member(organization_id) or
    (visibility='partners' and exists(select 1 from ct_current_org_ids() me where ct_has_active_relationship(me,certificates.organization_id)))
  )
);
drop policy if exists ct_certificates_insert on public.certificates;
create policy ct_certificates_insert on public.certificates
for insert to authenticated with check (
  ct_is_platform_admin() or ct_has_org_role(organization_id,array['owner','admin','member'])
);
drop policy if exists ct_certificates_update on public.certificates;
create policy ct_certificates_update on public.certificates
for update to authenticated using (
  ct_is_platform_admin() or ct_has_org_role(organization_id,array['owner','admin','member'])
) with check (
  ct_is_platform_admin() or ct_has_org_role(organization_id,array['owner','admin','member'])
);
-- No client DELETE policy: UI deletion is soft delete via UPDATE.

drop policy if exists ct_relationships_select on public.organization_relationships;
create policy ct_relationships_select on public.organization_relationships
for select to authenticated using (
  ct_is_platform_admin() or ct_is_org_member(requester_id) or ct_is_org_member(partner_id)
);
-- No direct INSERT/UPDATE/DELETE policies: lifecycle changes go through RPC functions.

drop policy if exists ct_relationship_invitations_select on public.relationship_invitations;
create policy ct_relationship_invitations_select on public.relationship_invitations
for select to authenticated using (
  ct_is_platform_admin() or ct_is_org_member(requester_organization_id) or (target_organization_id is not null and ct_is_org_member(target_organization_id)) or lower(invitee_email)=lower(auth.jwt()->>'email')
);
drop policy if exists ct_relationship_invitations_insert on public.relationship_invitations;
create policy ct_relationship_invitations_insert on public.relationship_invitations
for insert to authenticated with check (
  status='pending' and requested_by=auth.uid() and (ct_is_platform_admin() or ct_has_org_role(requester_organization_id,array['owner','admin','member']))
);

drop policy if exists ct_notification_preferences_select on public.notification_preferences;
create policy ct_notification_preferences_select on public.notification_preferences
for select to authenticated using (ct_is_platform_admin() or user_id=auth.uid());
drop policy if exists ct_notification_preferences_manage on public.notification_preferences;
create policy ct_notification_preferences_manage on public.notification_preferences
for all to authenticated using (ct_is_platform_admin() or user_id=auth.uid())
with check (ct_is_platform_admin() or user_id=auth.uid());

drop policy if exists ct_notifications_select on public.notifications;
create policy ct_notifications_select on public.notifications
for select to authenticated using (ct_is_platform_admin() or user_id=auth.uid());
drop policy if exists ct_audit_select on public.audit_log;
create policy ct_audit_select on public.audit_log
for select to authenticated using (
  ct_is_platform_admin() or (organization_id is not null and ct_has_org_role(organization_id,array['owner','admin']))
);
-- Audit rows are trigger/service generated only.

drop policy if exists ct_platform_admins_select on public.platform_admins;
create policy ct_platform_admins_select on public.platform_admins
for select to authenticated using (ct_is_platform_admin());

-- -----------------------------------------------------------------------------
-- Private certificate storage
-- Canonical path: <organization_uuid>/<certificate_uuid>/<filename.pdf>
-- -----------------------------------------------------------------------------
create or replace function public.ct_storage_org_id(p_name text)
returns uuid language plpgsql immutable set search_path=public as $$
declare first_part text;
begin
  first_part := (storage.foldername(p_name))[1];
  if first_part is null or first_part !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return null; end if;
  return first_part::uuid;
exception when others then return null;
end;
$$;
grant execute on function public.ct_storage_org_id(text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('organizationcertificates','organizationcertificates',false,26214400,array['application/pdf'])
on conflict (id) do update set public=false,file_size_limit=26214400,allowed_mime_types=array['application/pdf'];

-- Remove both old and Phase 33 policy names before recreation.
drop policy if exists "organization_certificates_storage_read" on storage.objects;
drop policy if exists "organization_certificates_storage_insert" on storage.objects;
drop policy if exists "organization_certificates_storage_update" on storage.objects;
drop policy if exists "organization_certificates_storage_delete" on storage.objects;
drop policy if exists ct_storage_select on storage.objects;
drop policy if exists ct_storage_insert on storage.objects;
drop policy if exists ct_storage_update on storage.objects;
drop policy if exists ct_storage_delete on storage.objects;

drop policy if exists ct_storage_select on storage.objects;
create policy ct_storage_select on storage.objects
for select to authenticated using (
  bucket_id='organizationcertificates' and (
    ct_is_platform_admin() or
    ct_is_org_member(ct_storage_org_id(name)) or
    exists(
      select 1 from public.certificates c
      where c.storage_path=storage.objects.name and c.deleted_at is null and c.visibility='partners'
        and exists(select 1 from ct_current_org_ids() me where ct_has_active_relationship(me,c.organization_id))
    )
  )
);
drop policy if exists ct_storage_insert on storage.objects;
create policy ct_storage_insert on storage.objects
for insert to authenticated with check (
  bucket_id='organizationcertificates' and ct_has_org_role(ct_storage_org_id(name),array['owner','admin','member'])
);
drop policy if exists ct_storage_update on storage.objects;
create policy ct_storage_update on storage.objects
for update to authenticated using (
  bucket_id='organizationcertificates' and ct_has_org_role(ct_storage_org_id(name),array['owner','admin','member'])
) with check (
  bucket_id='organizationcertificates' and ct_has_org_role(ct_storage_org_id(name),array['owner','admin','member'])
);
drop policy if exists ct_storage_delete on storage.objects;
create policy ct_storage_delete on storage.objects
for delete to authenticated using (
  bucket_id='organizationcertificates' and ct_has_org_role(ct_storage_org_id(name),array['owner','admin'])
);

create or replace function public.ct_mark_notification_read(p_notification uuid, p_read boolean default true)
returns void language sql security definer set search_path=public as $$
  update public.notifications set read_at=case when p_read then now() else null end
  where id=p_notification and user_id=auth.uid();
$$;
grant execute on function public.ct_mark_notification_read(uuid,boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Public/authenticated lookup RPCs used by login and partner invitation screens
-- -----------------------------------------------------------------------------
create or replace function public.resolve_organization_login(lookup_afm text)
returns table(id uuid,name text,afm text,email text,blocked boolean,status text)
language sql stable security definer set search_path=public
as $$
  select o.id,coalesce(o.display_name,o.legal_name),o.vat_number,o.contact_email,o.blocked,o.status
  from public.organizations o
  where o.country_code='GR' and ct_normalize_vat(o.vat_number)=ct_normalize_vat(lookup_afm)
    and o.deleted_at is null
  limit 1
$$;
revoke all on function public.resolve_organization_login(text) from public;
grant execute on function public.resolve_organization_login(text) to authenticated;

create or replace function public.find_organization_partner(search_value text)
returns table(id uuid,name text,afm text,email text,user_id uuid)
language sql stable security definer set search_path=public
as $$
  select o.id,coalesce(o.display_name,o.legal_name),o.vat_number,o.contact_email,null::uuid
  from public.organizations o
  where auth.uid() is not null and o.status='active' and o.deleted_at is null
    and (ct_normalize_vat(o.vat_number)=ct_normalize_vat(search_value) or lower(o.contact_email)=lower(trim(search_value)))
    and not ct_is_org_member(o.id)
  limit 1
$$;
revoke all on function public.find_organization_partner(text) from public;
grant execute on function public.find_organization_partner(text) to authenticated;

-- Prevent direct grants from accidentally bypassing intended RLS behavior.
grant select on public.organizations to authenticated;
grant update (display_name,contact_email,phone,website,address_line1,address_line2,city,postal_code) on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select on public.certificate_types to authenticated;
grant select,insert,update on public.certificates to authenticated;
grant select on public.organization_relationships to authenticated;
grant select,insert on public.relationship_invitations to authenticated;
grant select,insert,update,delete on public.notification_preferences to authenticated;
grant select on public.notifications to authenticated;
grant select on public.audit_log to authenticated;
grant select on public.platform_admins to authenticated;


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

drop policy if exists ct_certificate_files_select on public.certificate_files;
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

drop policy if exists ct_storage_select on storage.objects;
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

drop policy if exists ct_storage_insert on storage.objects;
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



-- CertiTrack Phase 36 — Relationships, invitations, notifications and partner access

alter table public.relationship_invitations add column if not exists relationship_id uuid references public.organization_relationships(id) on delete set null;
alter table public.relationship_invitations add column if not exists cancelled_at timestamptz;
alter table public.relationship_invitations add column if not exists cancelled_by uuid references auth.users(id) on delete set null;

create unique index if not exists relationship_invitation_pending_target_uq
on public.relationship_invitations(requester_organization_id,target_organization_id)
where status='pending' and target_organization_id is not null;

create unique index if not exists relationship_invitation_pending_email_uq
on public.relationship_invitations(requester_organization_id,lower(invitee_email))
where status='pending' and invitee_email is not null and target_organization_id is null;

create or replace function public.ct_relationship_notify_members(
  p_org uuid,p_type text,p_title text,p_body text,p_entity uuid,p_dedupe_prefix text,p_severity text default 'info'
) returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(organization_id,user_id,type,severity,title,body,entity_type,entity_id,dedupe_key)
  select p_org,m.user_id,p_type,p_severity,p_title,p_body,'organization_relationship',p_entity,
         p_dedupe_prefix||':'||m.user_id::text
  from public.organization_members m
  left join public.notification_preferences np on np.organization_id=m.organization_id and np.user_id=m.user_id
  where m.organization_id=p_org and m.status='active'
    and m.role in ('owner','admin')
    and coalesce(np.in_app_enabled,true)=true
    and coalesce(np.relationship_notifications,true)=true
  on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
end; $$;
revoke all on function public.ct_relationship_notify_members(uuid,text,text,text,uuid,text,text) from public;
grant execute on function public.ct_relationship_notify_members(uuid,text,text,text,uuid,text,text) to authenticated;

create or replace function public.ct_create_relationship_invitation(p_requester_org uuid,p_lookup text)
returns public.relationship_invitations language plpgsql security definer set search_path=public as $$
declare
  term text:=lower(trim(p_lookup)); target public.organizations; inv public.relationship_invitations; rel public.organization_relationships;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not ct_has_org_role(p_requester_org,array['owner','admin','member']) then raise exception 'Insufficient permission'; end if;
  if term='' then raise exception 'VAT or email is required'; end if;

  select * into target from public.organizations o
  where o.deleted_at is null and o.status='active'
    and (lower(o.contact_email)=term or ct_normalize_vat(o.vat_number)=ct_normalize_vat(term))
  limit 1;

  if target.id is not null then
    if target.id=p_requester_org then raise exception 'Cannot invite your own organization'; end if;
    if exists(select 1 from public.organization_relationships r where r.status in ('pending','active','blocked')
      and ((r.requester_id=p_requester_org and r.partner_id=target.id) or (r.requester_id=target.id and r.partner_id=p_requester_org))) then
      raise exception 'Relationship already exists or is pending';
    end if;
    insert into public.organization_relationships(requester_id,partner_id,status,relationship_type,requested_by)
    values(p_requester_org,target.id,'pending','partner',auth.uid()) returning * into rel;

    insert into public.relationship_invitations(requester_organization_id,target_organization_id,invitee_email,invitee_country_code,invitee_vat_number,status,requested_by,relationship_id)
    values(p_requester_org,target.id,target.contact_email,target.country_code,target.vat_number,'pending',auth.uid(),rel.id)
    returning * into inv;

    perform public.ct_relationship_notify_members(target.id,'relationship_invite','Νέο αίτημα συνεργασίας',
      'Ένας οργανισμός σας έστειλε αίτημα συνεργασίας.',rel.id,'relationship-invite:'||rel.id::text,'info');
  else
    if position('@' in term)=0 then raise exception 'No registered organization was found. Use an email address to invite an unregistered organization'; end if;
    insert into public.relationship_invitations(requester_organization_id,invitee_email,status,requested_by)
    values(p_requester_org,term,'pending',auth.uid()) returning * into inv;
  end if;
  return inv;
end; $$;

create or replace function public.ct_respond_relationship(p_relationship uuid,p_accept boolean)
returns public.organization_relationships language plpgsql security definer set search_path=public as $$
declare r public.organization_relationships;
begin
  select * into r from public.organization_relationships where id=p_relationship for update;
  if r.id is null then raise exception 'Relationship not found'; end if;
  if r.status<>'pending' then raise exception 'Relationship is not pending'; end if;
  if not ct_has_org_role(r.partner_id,array['owner','admin']) then raise exception 'Only the invited organization owner/admin may respond'; end if;
  update public.organization_relationships set status=case when p_accept then 'active' else 'declined' end,
    accepted_by=case when p_accept then auth.uid() else null end,accepted_at=case when p_accept then now() else null end,updated_at=now()
  where id=p_relationship returning * into r;
  update public.relationship_invitations set status=case when p_accept then 'accepted' else 'declined' end,responded_at=now(),updated_at=now()
  where relationship_id=p_relationship and status='pending';
  perform public.ct_relationship_notify_members(r.requester_id,case when p_accept then 'relationship_accepted' else 'relationship_declined' end,
    case when p_accept then 'Η συνεργασία έγινε αποδεκτή' else 'Το αίτημα συνεργασίας απορρίφθηκε' end,
    case when p_accept then 'Ο συνεργαζόμενος οργανισμός αποδέχθηκε το αίτημά σας.' else 'Ο οργανισμός απέρριψε το αίτημά σας.' end,
    r.id,'relationship-response:'||r.id::text,case when p_accept then 'success' else 'warning' end);
  return r;
end; $$;

create or replace function public.ct_cancel_relationship_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path=public as $$
declare inv public.relationship_invitations;
begin
  select * into inv from public.relationship_invitations where id=p_invitation for update;
  if inv.id is null then return; end if;
  if inv.status<>'pending' then raise exception 'Invitation is not pending'; end if;
  if not ct_has_org_role(inv.requester_organization_id,array['owner','admin','member']) then raise exception 'Insufficient permission'; end if;
  update public.relationship_invitations set status='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),updated_at=now() where id=inv.id;
  if inv.relationship_id is not null then
    update public.organization_relationships set status='ended',ended_by=auth.uid(),ended_at=now(),end_reason='invitation_cancelled',updated_at=now()
    where id=inv.relationship_id and status='pending';
  end if;
end; $$;

grant execute on function public.ct_create_relationship_invitation(uuid,text) to authenticated;
grant execute on function public.ct_cancel_relationship_invitation(uuid) to authenticated;

-- Canonical pending-request cancellation: hard delete
create or replace function public.ct_cancel_relationship(p_relationship uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.organization_relationships;
begin
  select * into r
  from public.organization_relationships
  where id=p_relationship
  for update;

  if r.id is null then
    return;
  end if;

  if r.status <> 'pending' then
    raise exception 'Only a pending relationship request can be cancelled';
  end if;

  if not public.ct_has_org_role(r.requester_id,array['owner','admin','member']) then
    raise exception 'Insufficient permission';
  end if;

  delete from public.relationship_invitations
  where relationship_id=p_relationship
    and status='pending';

  delete from public.email_outbox
  where template_key='relationship_invite'
    and payload->>'relationship_id'=p_relationship::text
    and status in ('pending','processing','failed');

  delete from public.organization_relationships
  where id=p_relationship;
end;
$$;

grant execute on function public.ct_cancel_relationship(uuid) to authenticated;

-- Client invitation writes now go only through lifecycle RPCs.
drop policy if exists ct_relationship_invitations_insert on public.relationship_invitations;
revoke insert,update,delete on public.relationship_invitations from authenticated;
grant select on public.relationship_invitations to authenticated;



-- CertiTrack Phase 37 — Notifications, expiry engine and email outbox
-- Apply after Phase33, Phase35 and Phase36.

-- -----------------------------------------------------------------------------
-- Notification preferences hardening
-- -----------------------------------------------------------------------------
alter table public.notification_preferences
  add column if not exists expiry_in_app_enabled boolean not null default true;
alter table public.notification_preferences
  add column if not exists expiry_email_enabled boolean not null default true;

-- -----------------------------------------------------------------------------
-- Server-side email outbox
-- Never expose provider/API secrets to the browser.
-- -----------------------------------------------------------------------------
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete cascade,
  recipient_email text not null,
  template_key text not null
    check (template_key in ('certificate_expiry','certificate_expired','relationship_invite','relationship_accepted','relationship_declined','system')),
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  status text not null default 'pending'
    check (status in ('pending','processing','sent','failed','cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  provider_message_id text,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_outbox_pending_idx
  on public.email_outbox(status,next_attempt_at,created_at)
  where status in ('pending','failed');

alter table public.email_outbox enable row level security;
-- No client policies. Only service-side processing may read/write the outbox.
revoke all on public.email_outbox from anon,authenticated;

drop trigger if exists ct_touch_updated_at on public.email_outbox;
create trigger ct_touch_updated_at before update on public.email_outbox
for each row execute procedure public.ct_touch_updated_at();

-- -----------------------------------------------------------------------------
-- Relationship email queue
-- Registered organizations respect user notification preferences.
-- Unregistered invitees receive the invitation at the supplied email.
-- -----------------------------------------------------------------------------
create or replace function public.ct_queue_relationship_invitation_email()
returns trigger
language plpgsql
security definer
set search_path=public,auth
as $$
declare requester_name text;
begin
  select coalesce(display_name,legal_name,'Οργανισμός') into requester_name
  from public.organizations where id=new.requester_organization_id;

  if new.target_organization_id is null then
    if new.invitee_email is not null then
      insert into public.email_outbox(
        organization_id,user_id,notification_id,recipient_email,template_key,subject,payload,dedupe_key
      ) values(
        new.requester_organization_id,null,null,new.invitee_email,'relationship_invite',
        'CertiTrack — Πρόσκληση συνεργασίας',
        jsonb_build_object('invitation_id',new.id,'requester_name',requester_name),
        'relationship-invite-email:'||new.id::text||':'||lower(new.invitee_email)
      ) on conflict (dedupe_key) do nothing;
    end if;
  else
    insert into public.email_outbox(
      organization_id,user_id,recipient_email,template_key,subject,payload,dedupe_key
    )
    select new.target_organization_id,m.user_id,u.email,'relationship_invite',
           'CertiTrack — Νέο αίτημα συνεργασίας',
           jsonb_build_object('invitation_id',new.id,'relationship_id',new.relationship_id,'requester_name',requester_name),
           'relationship-invite-email:'||new.id::text||':'||m.user_id::text
    from public.organization_members m
    join auth.users u on u.id=m.user_id
    left join public.notification_preferences np on np.organization_id=m.organization_id and np.user_id=m.user_id
    where m.organization_id=new.target_organization_id
      and m.status='active' and m.role in ('owner','admin')
      and u.email is not null
      and coalesce(np.email_enabled,true)=true
      and coalesce(np.relationship_notifications,true)=true
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists ct_queue_relationship_invitation_email on public.relationship_invitations;
create trigger ct_queue_relationship_invitation_email
after insert on public.relationship_invitations
for each row execute procedure public.ct_queue_relationship_invitation_email();

create or replace function public.ct_queue_relationship_response_email()
returns trigger
language plpgsql
security definer
set search_path=public,auth
as $$
declare partner_name text;
begin
  if old.status is not distinct from new.status or new.status not in ('accepted','declined') then return new; end if;

  if new.target_organization_id is not null then
    select coalesce(display_name,legal_name,'Οργανισμός') into partner_name
    from public.organizations where id=new.target_organization_id;
  else
    partner_name:=coalesce(new.invitee_email,'Οργανισμός');
  end if;

  insert into public.email_outbox(
    organization_id,user_id,recipient_email,template_key,subject,payload,dedupe_key
  )
  select new.requester_organization_id,m.user_id,u.email,
         case when new.status='accepted' then 'relationship_accepted' else 'relationship_declined' end,
         case when new.status='accepted' then 'CertiTrack — Η συνεργασία έγινε αποδεκτή'
              else 'CertiTrack — Το αίτημα συνεργασίας απορρίφθηκε' end,
         jsonb_build_object('invitation_id',new.id,'relationship_id',new.relationship_id,'partner_name',partner_name),
         'relationship-response-email:'||new.id::text||':'||new.status||':'||m.user_id::text
  from public.organization_members m
  join auth.users u on u.id=m.user_id
  left join public.notification_preferences np on np.organization_id=m.organization_id and np.user_id=m.user_id
  where m.organization_id=new.requester_organization_id
    and m.status='active' and m.role in ('owner','admin')
    and u.email is not null
    and coalesce(np.email_enabled,true)=true
    and coalesce(np.relationship_notifications,true)=true
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

drop trigger if exists ct_queue_relationship_response_email on public.relationship_invitations;
create trigger ct_queue_relationship_response_email
after update of status on public.relationship_invitations
for each row execute procedure public.ct_queue_relationship_response_email();

-- -----------------------------------------------------------------------------
-- Expiry notification generator
-- -----------------------------------------------------------------------------
create or replace function public.ct_generate_expiry_notifications(p_today date default current_date)
returns table(created_notifications integer, queued_emails integer)
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_notifications integer := 0;
  v_emails integer := 0;
  v_rows integer := 0;
begin
  -- Upcoming/expiry-day notification:
  -- choose the closest configured threshold >= days remaining.
  with candidates as (
    select
      c.id certificate_id,
      c.organization_id,
      c.title,
      c.expiry_date,
      m.user_id,
      u.email recipient_email,
      np.in_app_enabled,
      np.email_enabled,
      np.expiry_in_app_enabled,
      np.expiry_email_enabled,
      (
        select min(w)
        from unnest(coalesce(np.expiry_warning_days,array[90,60,30,15,7,0])) w
        where w >= (c.expiry_date - p_today) and (c.expiry_date - p_today) >= 0
      ) warning_day
    from public.certificates c
    join public.organization_members m
      on m.organization_id=c.organization_id
     and m.status='active'
     and m.role in ('owner','admin')
    join auth.users u on u.id=m.user_id
    left join public.notification_preferences np
      on np.organization_id=m.organization_id and np.user_id=m.user_id
    where c.deleted_at is null
      and c.expiry_date is not null
      and c.expiry_date >= p_today
      and coalesce(np.expiry_warning_days,array[90,60,30,15,7,0]) && array[0,1,3,7,14,15,30,45,60,90,120,180,365]
  ),
  inserted as (
    insert into public.notifications(
      organization_id,user_id,type,severity,title,body,entity_type,entity_id,dedupe_key,metadata
    )
    select
      x.organization_id,x.user_id,'certificate_expiry',
      case when x.warning_day=0 then 'critical'
           when x.warning_day<=7 then 'critical'
           when x.warning_day<=30 then 'warning'
           else 'info' end,
      case when x.warning_day=0 then 'Το πιστοποιητικό λήγει σήμερα'
           else 'Πιστοποιητικό προς λήξη' end,
      case when x.warning_day=0
           then x.title||' λήγει σήμερα.'
           else x.title||' λήγει σε '||x.warning_day::text||' ημέρες.' end,
      'certificate',x.certificate_id,
      'certificate-expiry:'||x.certificate_id::text||':'||x.warning_day::text,
      jsonb_build_object(
        'certificate_id',x.certificate_id,
        'certificate_title',x.title,
        'expiry_date',x.expiry_date,
        'warning_days',x.warning_day
      )
    from candidates x
    where x.warning_day is not null
      and coalesce(x.in_app_enabled,true)=true
      and coalesce(x.expiry_in_app_enabled,true)=true
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing
    returning *
  )
  select count(*) into v_notifications from inserted;

  -- Queue email independently from in-app preference, with its own dedupe.
  insert into public.email_outbox(
    organization_id,user_id,recipient_email,template_key,subject,payload,dedupe_key
  )
  select
    x.organization_id,x.user_id,x.recipient_email,'certificate_expiry',
    case when x.warning_day=0 then 'CertiTrack — Πιστοποιητικό λήγει σήμερα'
         else 'CertiTrack — Πιστοποιητικό προς λήξη' end,
    jsonb_build_object(
      'certificate_id',x.certificate_id,
      'certificate_title',x.title,
      'expiry_date',x.expiry_date,
      'warning_days',x.warning_day
    ),
    'certificate-expiry-email:'||x.certificate_id::text||':'||x.user_id::text||':'||x.warning_day::text
  from (
    select
      c.id certificate_id,c.organization_id,c.title,c.expiry_date,
      m.user_id,u.email recipient_email,
      np.email_enabled,np.expiry_email_enabled,
      (
        select min(w)
        from unnest(coalesce(np.expiry_warning_days,array[90,60,30,15,7,0])) w
        where w >= (c.expiry_date-p_today) and (c.expiry_date-p_today) >= 0
      ) warning_day
    from public.certificates c
    join public.organization_members m
      on m.organization_id=c.organization_id
     and m.status='active'
     and m.role in ('owner','admin')
    join auth.users u on u.id=m.user_id
    left join public.notification_preferences np
      on np.organization_id=m.organization_id and np.user_id=m.user_id
    where c.deleted_at is null and c.expiry_date is not null and c.expiry_date>=p_today
  ) x
  where x.warning_day is not null
    and x.recipient_email is not null
    and coalesce(x.email_enabled,true)=true
    and coalesce(x.expiry_email_enabled,true)=true
  on conflict (dedupe_key) do nothing;
  get diagnostics v_emails = row_count;

  -- Once overdue, create exactly one persistent "expired" notification/email per certificate/user.
  with expired_candidates as (
    select c.id certificate_id,c.organization_id,c.title,c.expiry_date,m.user_id,u.email recipient_email,
           np.in_app_enabled,np.email_enabled,np.expiry_in_app_enabled,np.expiry_email_enabled
    from public.certificates c
    join public.organization_members m
      on m.organization_id=c.organization_id and m.status='active' and m.role in ('owner','admin')
    join auth.users u on u.id=m.user_id
    left join public.notification_preferences np
      on np.organization_id=m.organization_id and np.user_id=m.user_id
    where c.deleted_at is null and c.expiry_date is not null and c.expiry_date < p_today
  ),
  inserted_expired as (
    insert into public.notifications(
      organization_id,user_id,type,severity,title,body,entity_type,entity_id,dedupe_key,metadata
    )
    select organization_id,user_id,'certificate_expired','critical','Ληγμένο πιστοποιητικό',
           title||' έχει λήξει.','certificate',certificate_id,
           'certificate-expired:'||certificate_id::text,
           jsonb_build_object('certificate_id',certificate_id,'certificate_title',title,'expiry_date',expiry_date)
    from expired_candidates
    where coalesce(in_app_enabled,true)=true and coalesce(expiry_in_app_enabled,true)=true
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing
    returning *
  )
  select v_notifications + count(*) into v_notifications from inserted_expired;

  insert into public.email_outbox(
    organization_id,user_id,recipient_email,template_key,subject,payload,dedupe_key
  )
  select organization_id,user_id,recipient_email,'certificate_expired',
         'CertiTrack — Ληγμένο πιστοποιητικό',
         jsonb_build_object('certificate_id',certificate_id,'certificate_title',title,'expiry_date',expiry_date),
         'certificate-expired-email:'||certificate_id::text||':'||user_id::text
  from expired_candidates
  where recipient_email is not null
    and coalesce(email_enabled,true)=true and coalesce(expiry_email_enabled,true)=true
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count;
  v_emails := v_emails + v_rows;

  return query select v_notifications,v_emails;
end;
$$;

revoke all on function public.ct_generate_expiry_notifications(date) from public;
-- Scheduled/server invocation only. Do not grant to anon/authenticated.

-- -----------------------------------------------------------------------------
-- Email worker helpers (service role only through Edge Function)
-- -----------------------------------------------------------------------------
create or replace function public.ct_claim_email_batch(p_worker text,p_limit integer default 50)
returns setof public.email_outbox
language plpgsql
security definer
set search_path=public
as $$
begin
  return query
  with picked as (
    select id
    from public.email_outbox
    where status in ('pending','failed')
      and next_attempt_at<=now()
      and attempts<5
      and (locked_at is null or locked_at < now()-interval '15 minutes')
    order by created_at
    for update skip locked
    limit greatest(1,least(p_limit,100))
  )
  update public.email_outbox q
     set status='processing',locked_at=now(),locked_by=p_worker,attempts=attempts+1,updated_at=now()
  from picked
  where q.id=picked.id
  returning q.*;
end;
$$;

create or replace function public.ct_complete_email(
  p_id uuid,p_success boolean,p_provider_message_id text default null,p_error text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.email_outbox
  set status=case
        when p_success then 'sent'
        when attempts>=5 then 'failed'
        else 'failed'
      end,
      provider_message_id=case when p_success then p_provider_message_id else provider_message_id end,
      sent_at=case when p_success then now() else sent_at end,
      last_error=case when p_success then null else left(coalesce(p_error,'Unknown delivery error'),2000) end,
      next_attempt_at=case
        when p_success then next_attempt_at
        else now() + make_interval(mins => least(240, power(2,greatest(attempts,1))::integer * 5))
      end,
      locked_at=null,locked_by=null,updated_at=now()
  where id=p_id;
end;
$$;

revoke all on function public.ct_claim_email_batch(text,integer) from public;
revoke all on function public.ct_complete_email(uuid,boolean,text,text) from public;
grant execute on function public.ct_generate_expiry_notifications(date) to service_role;
grant execute on function public.ct_claim_email_batch(text,integer) to service_role;
grant execute on function public.ct_complete_email(uuid,boolean,text,text) to service_role;

-- -----------------------------------------------------------------------------
-- User preferences RPC: a user may only change their own notification preferences.
-- -----------------------------------------------------------------------------
create or replace function public.ct_update_notification_preferences(
  p_organization uuid,
  p_in_app boolean,
  p_email boolean,
  p_expiry_in_app boolean,
  p_expiry_email boolean,
  p_warning_days integer[],
  p_relationship boolean,
  p_certificate_change boolean
)
returns public.notification_preferences
language plpgsql
security definer
set search_path=public
as $$
declare result public.notification_preferences;
begin
  if not ct_is_org_member(p_organization) then raise exception 'Insufficient permission'; end if;
  if not (p_warning_days <@ array[0,1,3,7,14,15,30,45,60,90,120,180,365]) then
    raise exception 'Invalid expiry warning days';
  end if;
  insert into public.notification_preferences(
    organization_id,user_id,in_app_enabled,email_enabled,expiry_in_app_enabled,expiry_email_enabled,
    expiry_warning_days,relationship_notifications,certificate_change_notifications
  ) values(
    p_organization,auth.uid(),p_in_app,p_email,p_expiry_in_app,p_expiry_email,
    p_warning_days,p_relationship,p_certificate_change
  )
  on conflict (organization_id,user_id) do update set
    in_app_enabled=excluded.in_app_enabled,
    email_enabled=excluded.email_enabled,
    expiry_in_app_enabled=excluded.expiry_in_app_enabled,
    expiry_email_enabled=excluded.expiry_email_enabled,
    expiry_warning_days=excluded.expiry_warning_days,
    relationship_notifications=excluded.relationship_notifications,
    certificate_change_notifications=excluded.certificate_change_notifications,
    updated_at=now()
  returning * into result;
  return result;
end;
$$;
grant execute on function public.ct_update_notification_preferences(uuid,boolean,boolean,boolean,boolean,integer[],boolean,boolean) to authenticated;



-- CertiTrack Phase 38 — Audit, membership and organization account lifecycle
-- Apply after Phase37.

-- -----------------------------------------------------------------------------
-- Organization lifecycle metadata
-- -----------------------------------------------------------------------------
alter table public.organizations add column if not exists closure_requested_at timestamptz;
alter table public.organizations add column if not exists closure_requested_by uuid references auth.users(id) on delete set null;
alter table public.organizations add column if not exists closure_reason text;
alter table public.organizations add column if not exists suspended_at timestamptz;
alter table public.organizations add column if not exists suspended_by uuid references auth.users(id) on delete set null;
alter table public.organizations add column if not exists suspension_reason text;

-- -----------------------------------------------------------------------------
-- Append-only audit
-- -----------------------------------------------------------------------------
revoke insert,update,delete on public.audit_log from anon,authenticated;

create or replace function public.ct_write_audit(
  p_org uuid,p_action text,p_entity_type text,p_entity_id text,
  p_old jsonb default null,p_new jsonb default null,p_metadata jsonb default '{}'::jsonb,
  p_actor uuid default auth.uid()
) returns void
language plpgsql security definer set search_path=public
as $$
begin
  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,old_data,new_data,metadata)
  values(p_org,p_actor,p_action,p_entity_type,p_entity_id,p_old,p_new,coalesce(p_metadata,'{}'::jsonb));
end;
$$;
revoke all on function public.ct_write_audit(uuid,text,text,text,jsonb,jsonb,jsonb,uuid) from public;

create or replace function public.ct_audit_row_change()
returns trigger
language plpgsql security definer set search_path=public
as $$
declare org uuid; eid text; oldj jsonb; newj jsonb;
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
  elsif tg_table_name='organization_members' then
    org:=coalesce(nullif(newj->>'organization_id','')::uuid,nullif(oldj->>'organization_id','')::uuid);
  elsif tg_table_name='organizations' then org:=eid::uuid;
  end if;

  perform public.ct_write_audit(org,lower(tg_op),tg_table_name,eid,oldj,newj,
    jsonb_build_object('trigger',true,'table',tg_table_name),auth.uid());
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists ct_audit_organization_members on public.organization_members;
create trigger ct_audit_organization_members
after insert or update or delete on public.organization_members
for each row execute procedure public.ct_audit_row_change();

-- -----------------------------------------------------------------------------
-- Platform-admin audit visibility; normal members remain tenant-scoped.
-- -----------------------------------------------------------------------------
drop policy if exists ct_audit_select on public.audit_log;
drop policy if exists ct_audit_select on public.audit_log;
create policy ct_audit_select on public.audit_log for select to authenticated
using (ct_is_platform_admin() or ct_is_org_member(organization_id));

-- -----------------------------------------------------------------------------
-- Membership lifecycle
-- -----------------------------------------------------------------------------
create or replace function public.ct_change_member_role(p_org uuid,p_member uuid,p_role text)
returns public.organization_members
language plpgsql security definer set search_path=public
as $$
declare m public.organization_members; owner_count integer;
begin
  if p_role not in ('owner','admin','member','viewer') then raise exception 'Invalid role'; end if;
  if not ct_has_org_role(p_org,array['owner','admin']) then raise exception 'Insufficient permission'; end if;
  select * into m from public.organization_members where id=p_member and organization_id=p_org for update;
  if m.id is null then raise exception 'Member not found'; end if;
  if m.role='owner' and p_role<>'owner' then
    select count(*) into owner_count from public.organization_members
    where organization_id=p_org and role='owner' and status='active';
    if owner_count<=1 then raise exception 'The organization must retain at least one active owner'; end if;
  end if;
  update public.organization_members set role=p_role,updated_at=now() where id=m.id returning * into m;
  return m;
end;
$$;

create or replace function public.ct_remove_member(p_org uuid,p_member uuid)
returns void
language plpgsql security definer set search_path=public
as $$
declare m public.organization_members; owner_count integer;
begin
  if not ct_has_org_role(p_org,array['owner','admin']) then raise exception 'Insufficient permission'; end if;
  select * into m from public.organization_members where id=p_member and organization_id=p_org for update;
  if m.id is null then return; end if;
  if m.user_id=auth.uid() and m.role='owner' then raise exception 'Transfer ownership before removing yourself'; end if;
  if m.role='owner' and m.status='active' then
    select count(*) into owner_count from public.organization_members where organization_id=p_org and role='owner' and status='active';
    if owner_count<=1 then raise exception 'The organization must retain at least one active owner'; end if;
  end if;
  update public.organization_members set status='removed',removed_at=now(),updated_at=now() where id=m.id;
end;
$$;

grant execute on function public.ct_change_member_role(uuid,uuid,text) to authenticated;
grant execute on function public.ct_remove_member(uuid,uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Organization closure: request -> platform review -> close/cancel.
-- This never hard-deletes certificates, files, relationships or audit records.
-- -----------------------------------------------------------------------------
create or replace function public.ct_request_organization_closure(p_org uuid,p_reason text default null)
returns public.organizations
language plpgsql security definer set search_path=public
as $$
declare o public.organizations;
begin
  if not ct_has_org_role(p_org,array['owner']) then raise exception 'Only an owner may request organization closure'; end if;
  select * into o from public.organizations where id=p_org for update;
  if o.id is null then raise exception 'Organization not found'; end if;
  if o.status in ('closed','closure_requested') then raise exception 'Organization is already closed or awaiting closure'; end if;
  update public.organizations set status='closure_requested',closure_requested_at=now(),
    closure_requested_by=auth.uid(),closure_reason=nullif(trim(p_reason),''),
    updated_at=now()
  where id=p_org returning * into o;
  perform public.ct_write_audit(p_org,'closure_requested','organization',p_org::text,null,to_jsonb(o),
    jsonb_build_object('reason',p_reason),auth.uid());
  return o;
end;
$$;

create or replace function public.ct_cancel_organization_closure(p_org uuid)
returns public.organizations
language plpgsql security definer set search_path=public
as $$
declare o public.organizations;
begin
  if not ct_has_org_role(p_org,array['owner']) then raise exception 'Only an owner may cancel closure'; end if;
  update public.organizations set status='active',closure_requested_at=null,closure_requested_by=null,
    closure_reason=null,updated_at=now()
  where id=p_org and status='closure_requested' returning * into o;
  if o.id is null then raise exception 'No closure request is pending'; end if;
  perform public.ct_write_audit(p_org,'closure_cancelled','organization',p_org::text,null,to_jsonb(o),'{}',auth.uid());
  return o;
end;
$$;

create or replace function public.ct_platform_set_organization_state(p_org uuid,p_state text,p_reason text default null)
returns public.organizations
language plpgsql security definer set search_path=public
as $$
declare o public.organizations;
begin
  if not ct_is_platform_admin() then raise exception 'Platform administrator required'; end if;
  if p_state not in ('active','suspended','closed') then raise exception 'Invalid organization state'; end if;
  select * into o from public.organizations where id=p_org for update;
  if o.id is null then raise exception 'Organization not found'; end if;

  update public.organizations set
    status=p_state,
    blocked=(p_state='suspended'),
    suspended_at=case when p_state='suspended' then now() else null end,
    suspended_by=case when p_state='suspended' then auth.uid() else null end,
    suspension_reason=case when p_state='suspended' then nullif(trim(p_reason),'') else null end,
    closed_at=case when p_state='closed' then now() else closed_at end,
    updated_at=now()
  where id=p_org returning * into o;

  if p_state='closed' then
    update public.organization_members set status='suspended',updated_at=now()
    where organization_id=p_org and status='active';
    update public.organization_relationships set status='ended',ended_at=now(),ended_by=auth.uid(),
      end_reason='organization_closed',updated_at=now()
    where status in ('pending','active')
      and (requester_id=p_org or partner_id=p_org);
  elsif p_state='active' then
    update public.organization_members set status='active',updated_at=now()
    where organization_id=p_org and status='suspended';
  end if;

  perform public.ct_write_audit(p_org,'organization_'||p_state,'organization',p_org::text,null,to_jsonb(o),
    jsonb_build_object('reason',p_reason),auth.uid());
  return o;
end;
$$;

grant execute on function public.ct_request_organization_closure(uuid,text) to authenticated;
grant execute on function public.ct_cancel_organization_closure(uuid) to authenticated;
grant execute on function public.ct_platform_set_organization_state(uuid,text,text) to authenticated;

-- -----------------------------------------------------------------------------
-- Block normal organization access when tenant is suspended/closed.
-- -----------------------------------------------------------------------------
create or replace function public.ct_is_org_operational(p_org uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(select 1 from public.organizations o
    where o.id=p_org and o.deleted_at is null and o.status in ('active','closure_requested') and o.blocked=false)
$$;
revoke all on function public.ct_is_org_operational(uuid) from public;
grant execute on function public.ct_is_org_operational(uuid) to authenticated;

-- Model version

-- =============================================================================
-- CANONICAL COMPLIANCE MODEL (neutral Organization-to-Organization)
-- =============================================================================
create table if not exists public.compliance_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists compliance_profiles_org_idx on public.compliance_profiles(organization_id,active);

create table if not exists public.compliance_profile_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.compliance_profiles(id) on delete cascade,
  certificate_type_id uuid not null references public.certificate_types(id) on delete cascade,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  unique(profile_id,certificate_type_id)
);

create table if not exists public.relationship_requirements (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.organization_relationships(id) on delete cascade,
  required_from_organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid references public.compliance_profiles(id) on delete set null,
  certificate_type_id uuid not null references public.certificate_types(id) on delete cascade,
  required boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(relationship_id,required_from_organization_id,certificate_type_id)
);
create index if not exists relationship_requirements_rel_idx
  on public.relationship_requirements(relationship_id,required_from_organization_id);

alter table public.compliance_profiles enable row level security;
alter table public.compliance_profile_items enable row level security;
alter table public.relationship_requirements enable row level security;

drop policy if exists ct_compliance_profiles_select on public.compliance_profiles;
create policy ct_compliance_profiles_select on public.compliance_profiles
for select to authenticated using (
  ct_is_platform_admin() or ct_is_org_member(organization_id)
);
drop policy if exists ct_compliance_profiles_manage on public.compliance_profiles;
create policy ct_compliance_profiles_manage on public.compliance_profiles
for all to authenticated using (
  ct_is_platform_admin() or ct_has_org_role(organization_id,array['owner','admin','member'])
) with check (
  ct_is_platform_admin() or ct_has_org_role(organization_id,array['owner','admin','member'])
);

drop policy if exists ct_compliance_profile_items_select on public.compliance_profile_items;
create policy ct_compliance_profile_items_select on public.compliance_profile_items
for select to authenticated using (
  ct_is_platform_admin() or exists(
    select 1 from public.compliance_profiles p
    where p.id=compliance_profile_items.profile_id and ct_is_org_member(p.organization_id)
  )
);
drop policy if exists ct_compliance_profile_items_manage on public.compliance_profile_items;
create policy ct_compliance_profile_items_manage on public.compliance_profile_items
for all to authenticated using (
  ct_is_platform_admin() or exists(
    select 1 from public.compliance_profiles p
    where p.id=compliance_profile_items.profile_id and ct_has_org_role(p.organization_id,array['owner','admin','member'])
  )
) with check (
  ct_is_platform_admin() or exists(
    select 1 from public.compliance_profiles p
    where p.id=compliance_profile_items.profile_id and ct_has_org_role(p.organization_id,array['owner','admin','member'])
  )
);

drop policy if exists ct_relationship_requirements_select on public.relationship_requirements;
create policy ct_relationship_requirements_select on public.relationship_requirements
for select to authenticated using (
  ct_is_platform_admin() or exists(
    select 1 from public.organization_relationships r
    where r.id=relationship_requirements.relationship_id
      and (ct_is_org_member(r.requester_id) or ct_is_org_member(r.partner_id))
  )
);
drop policy if exists ct_relationship_requirements_manage on public.relationship_requirements;
create policy ct_relationship_requirements_manage on public.relationship_requirements
for all to authenticated using (
  ct_is_platform_admin() or exists(
    select 1 from public.organization_relationships r
    where r.id=relationship_requirements.relationship_id
      and (
        ct_has_org_role(r.requester_id,array['owner','admin','member'])
        or ct_has_org_role(r.partner_id,array['owner','admin','member'])
      )
  )
) with check (
  ct_is_platform_admin() or exists(
    select 1 from public.organization_relationships r
    where r.id=relationship_requirements.relationship_id
      and (
        ct_has_org_role(r.requester_id,array['owner','admin','member'])
        or ct_has_org_role(r.partner_id,array['owner','admin','member'])
      )
  )
);

drop trigger if exists ct_touch_updated_at on public.compliance_profiles;
create trigger ct_touch_updated_at before update on public.compliance_profiles
for each row execute procedure public.ct_touch_updated_at();

drop trigger if exists ct_touch_updated_at on public.relationship_requirements;
create trigger ct_touch_updated_at before update on public.relationship_requirements
for each row execute procedure public.ct_touch_updated_at();

-- =============================================================================
-- FINAL PRODUCTION MODEL PROBE
-- =============================================================================
create or replace function public.organization_model_version()
returns text language sql stable security definer set search_path=public
as $$ select '39'::text $$;
revoke all on function public.organization_model_version() from public;
grant execute on function public.organization_model_version() to anon,authenticated;

commit;


-- Integrated from Phase 54: canonical partner lookup
-- Phase 54 — Add the missing ct_find_partner_candidate() function.
--
-- src/services/organizationService.js has always called
-- supabase.rpc('ct_find_partner_candidate', {p_lookup: term}) as a
-- read-only "preview" step before sending a partner invitation (so the UI
-- can show "is this the organization you mean?" before committing). This
-- function was never actually created anywhere in the schema -- every call
-- failed with a PostgREST "function not found" error, meaning the entire
-- "add partner" flow never got past the first step.
--
-- Mirrors the exact lookup logic already used inside
-- ct_create_relationship_invitation() (match by contact_email or
-- normalized VAT number, active + not-deleted organizations only).
-- Read-only, no side effects.

create or replace function public.ct_find_partner_candidate(p_lookup text)
returns table(id uuid, name text, afm text, email text)
language sql
stable
security definer
set search_path = public
as $$
  select o.id,
         coalesce(o.display_name, o.legal_name) as name,
         o.vat_number as afm,
         o.contact_email as email
  from public.organizations o
  where o.deleted_at is null
    and o.status = 'active'
    and (
      lower(o.contact_email) = lower(trim(p_lookup))
      or public.ct_normalize_vat(o.vat_number) = public.ct_normalize_vat(p_lookup)
    )
  limit 1;
$$;

grant execute on function public.ct_find_partner_candidate(text) to authenticated;

-- Verification query (run manually after applying):
--   select proname from pg_proc where proname = 'ct_find_partner_candidate';
