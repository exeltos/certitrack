-- CertiTrack Phase 3B: additive compliance foundation.
-- Safe to apply after 3A; existing screens do not depend on these tables yet.

begin;

create table if not exists public.certificate_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  requires_expiry boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.requirement_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, name)
);

create table if not exists public.requirement_profile_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.requirement_profiles(id) on delete cascade,
  certificate_type_id uuid not null references public.certificate_types(id),
  required boolean not null default true,
  created_at timestamptz not null default now(),
  unique(profile_id, certificate_type_id)
);

create table if not exists public.company_supplier_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  profile_id uuid references public.requirement_profiles(id) on delete set null,
  certificate_type_id uuid not null references public.certificate_types(id),
  required boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, supplier_id, certificate_type_id)
);

alter table public.company_certificates add column if not exists certificate_type_id uuid references public.certificate_types(id);
alter table public.supplier_certificates add column if not exists certificate_type_id uuid references public.certificate_types(id);
alter table public.company_certificates add column if not exists verification_status text not null default 'submitted';
alter table public.supplier_certificates add column if not exists verification_status text not null default 'submitted';

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.certificate_types enable row level security;
alter table public.requirement_profiles enable row level security;
alter table public.requirement_profile_items enable row level security;
alter table public.company_supplier_requirements enable row level security;
alter table public.audit_log enable row level security;

create policy certificate_types_read on public.certificate_types
for select to authenticated using (active = true);

create policy requirement_profiles_company_all on public.requirement_profiles
for all to authenticated
using (exists(select 1 from public.companies c where c.id=requirement_profiles.company_id and c.user_id=auth.uid()))
with check (exists(select 1 from public.companies c where c.id=requirement_profiles.company_id and c.user_id=auth.uid()));

create policy requirement_profile_items_company_read on public.requirement_profile_items
for select to authenticated
using (exists(
  select 1 from public.requirement_profiles rp
  join public.companies c on c.id=rp.company_id
  where rp.id=requirement_profile_items.profile_id and c.user_id=auth.uid()
));

create policy requirement_profile_items_company_write on public.requirement_profile_items
for all to authenticated
using (exists(
  select 1 from public.requirement_profiles rp
  join public.companies c on c.id=rp.company_id
  where rp.id=requirement_profile_items.profile_id and c.user_id=auth.uid()
))
with check (exists(
  select 1 from public.requirement_profiles rp
  join public.companies c on c.id=rp.company_id
  where rp.id=requirement_profile_items.profile_id and c.user_id=auth.uid()
));

create policy company_supplier_requirements_members_read on public.company_supplier_requirements
for select to authenticated
using (
  exists(select 1 from public.companies c where c.id=company_supplier_requirements.company_id and c.user_id=auth.uid())
  or exists(select 1 from public.suppliers s where s.id=company_supplier_requirements.supplier_id and s.user_id=auth.uid())
);

create policy company_supplier_requirements_company_write on public.company_supplier_requirements
for all to authenticated
using (exists(select 1 from public.companies c where c.id=company_supplier_requirements.company_id and c.user_id=auth.uid()))
with check (exists(select 1 from public.companies c where c.id=company_supplier_requirements.company_id and c.user_id=auth.uid()));

create policy audit_log_member_read on public.audit_log
for select to authenticated
using (
  (company_id is not null and exists(select 1 from public.companies c where c.id=audit_log.company_id and c.user_id=auth.uid()))
  or (supplier_id is not null and exists(select 1 from public.suppliers s where s.id=audit_log.supplier_id and s.user_id=auth.uid()))
);

insert into public.certificate_types(code,name,requires_expiry) values
('ISO9001','ISO 9001',true),
('ISO14001','ISO 14001',true),
('ISO45001','ISO 45001',true),
('ISO27001','ISO 27001',true),
('ISO13485','ISO 13485',true),
('CE','CE',true),
('TAX_CLEARANCE','Φορολογική ενημερότητα',true),
('INSURANCE_CLEARANCE','Ασφαλιστική ενημερότητα',true),
('OPERATING_LICENSE','Άδεια λειτουργίας',true),
('INSURANCE','Ασφάλιση',true)
on conflict (code) do nothing;

commit;
