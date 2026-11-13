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
  name_el text not null,
  name_en text not null,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.certificate_types(code,name_el,name_en,sort_order) values
  ('ISO9001','ISO 9001','ISO 9001',10),
  ('ISO13485','ISO 13485','ISO 13485',20),
  ('ISO14001','ISO 14001','ISO 14001',30),
  ('ISO27001','ISO 27001','ISO 27001',40),
  ('ISO45001','ISO 45001','ISO 45001',50),
  ('CE','Πιστοποιητικό CE','CE Certificate',60),
  ('OPERATING_LICENSE','Άδεια Λειτουργίας','Operating License',70),
  ('OTHER','Άλλο','Other',999)
on conflict (code) do update set
  name_el=excluded.name_el,
  name_en=excluded.name_en,
  sort_order=excluded.sort_order;

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

create policy ct_organizations_select on public.organizations
for select to authenticated using (
  deleted_at is null and (
    ct_is_platform_admin() or ct_is_org_member(id) or exists(
      select 1 from ct_current_org_ids() me where ct_has_active_relationship(me,organizations.id)
    )
  )
);
create policy ct_organizations_update on public.organizations
for update to authenticated using (ct_is_platform_admin() or ct_has_org_role(id,array['owner','admin']))
with check (ct_is_platform_admin() or ct_has_org_role(id,array['owner','admin']));

create policy ct_members_select on public.organization_members
for select to authenticated using (ct_is_platform_admin() or ct_is_org_member(organization_id));
create policy ct_certificate_types_select on public.certificate_types
for select to authenticated using (active=true or ct_is_platform_admin());

create policy ct_certificates_select on public.certificates
for select to authenticated using (
  deleted_at is null and (
    ct_is_platform_admin() or ct_is_org_member(organization_id) or
    (visibility='partners' and exists(select 1 from ct_current_org_ids() me where ct_has_active_relationship(me,certificates.organization_id)))
  )
);
create policy ct_certificates_insert on public.certificates
for insert to authenticated with check (
  ct_is_platform_admin() or ct_has_org_role(organization_id,array['owner','admin','member'])
);
create policy ct_certificates_update on public.certificates
for update to authenticated using (
  ct_is_platform_admin() or ct_has_org_role(organization_id,array['owner','admin','member'])
) with check (
  ct_is_platform_admin() or ct_has_org_role(organization_id,array['owner','admin','member'])
);
-- No client DELETE policy: UI deletion is soft delete via UPDATE.

create policy ct_relationships_select on public.organization_relationships
for select to authenticated using (
  ct_is_platform_admin() or ct_is_org_member(requester_id) or ct_is_org_member(partner_id)
);
-- No direct INSERT/UPDATE/DELETE policies: lifecycle changes go through RPC functions.

create policy ct_relationship_invitations_select on public.relationship_invitations
for select to authenticated using (
  ct_is_platform_admin() or ct_is_org_member(requester_organization_id) or (target_organization_id is not null and ct_is_org_member(target_organization_id)) or lower(invitee_email)=lower(auth.jwt()->>'email')
);
create policy ct_relationship_invitations_insert on public.relationship_invitations
for insert to authenticated with check (
  status='pending' and requested_by=auth.uid() and (ct_is_platform_admin() or ct_has_org_role(requester_organization_id,array['owner','admin','member']))
);

create policy ct_notification_preferences_select on public.notification_preferences
for select to authenticated using (ct_is_platform_admin() or user_id=auth.uid());
create policy ct_notification_preferences_manage on public.notification_preferences
for all to authenticated using (ct_is_platform_admin() or user_id=auth.uid())
with check (ct_is_platform_admin() or user_id=auth.uid());

create policy ct_notifications_select on public.notifications
for select to authenticated using (ct_is_platform_admin() or user_id=auth.uid());
create policy ct_audit_select on public.audit_log
for select to authenticated using (
  ct_is_platform_admin() or (organization_id is not null and ct_has_org_role(organization_id,array['owner','admin']))
);
-- Audit rows are trigger/service generated only.

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
create policy ct_storage_insert on storage.objects
for insert to authenticated with check (
  bucket_id='organizationcertificates' and ct_has_org_role(ct_storage_org_id(name),array['owner','admin','member'])
);
create policy ct_storage_update on storage.objects
for update to authenticated using (
  bucket_id='organizationcertificates' and ct_has_org_role(ct_storage_org_id(name),array['owner','admin','member'])
) with check (
  bucket_id='organizationcertificates' and ct_has_org_role(ct_storage_org_id(name),array['owner','admin','member'])
);
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

create or replace function public.organization_model_version()
returns text language sql stable security definer set search_path=public as $$ select '33'::text $$;
revoke all on function public.organization_model_version() from public;
grant execute on function public.organization_model_version() to anon,authenticated;

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
