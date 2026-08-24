-- CertiTrack current schema - Phase 48
begin;
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  display_name text not null,
  vat_number text not null,
  country_code text not null default 'GR',
  contact_email text,
  contact_phone text,
  status text not null default 'active' check (status in ('active','inactive','suspended')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_vat_unique unique (country_code, vat_number)
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_members_unique unique (organization_id,user_id)
);

create table if not exists public.organization_relationships (
  id uuid primary key default gen_random_uuid(),
  requester_organization_id uuid not null references public.organizations(id) on delete cascade,
  partner_organization_id uuid not null references public.organizations(id) on delete cascade,
  requester_name text not null,
  partner_name text not null,
  status text not null default 'pending' check (status in ('pending','active','rejected','ended')),
  requested_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_relationship_not_self check (requester_organization_id <> partner_organization_id),
  constraint organization_relationship_unique unique (requester_organization_id,partner_organization_id)
);

create table if not exists public.certificate_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  requires_expiry boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.certificate_types(code,name,requires_expiry,active) values
('CE','CE',true,true),('INSURANCE','Ασφάλιση',true,true),('INSURANCE_CLEARANCE','Ασφαλιστική ενημερότητα',true,true),
('ISO13485','ISO 13485',true,true),('ISO14001','ISO 14001',true,true),('ISO27001','ISO 27001',true,true),
('ISO45001','ISO 45001',true,true),('ISO9001','ISO 9001',true,true),('OPERATING_LICENSE','Άδεια λειτουργίας',true,true),
('OTHER','Άλλο',true,true),('TAX_CLEARANCE','Φορολογική ενημερότητα',true,true)
on conflict (code) do update set name=excluded.name, requires_expiry=excluded.requires_expiry, active=excluded.active;

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  organization_name text not null,
  certificate_type_id uuid references public.certificate_types(id) on delete set null,
  certificate_type_code text not null,
  certificate_type_name text not null,
  title text,
  certificate_number text,
  issuer_name text,
  issue_date date,
  expiry_date date,
  status text not null default 'active' check (status in ('active','expiring','expired','revoked','draft')),
  visibility text not null default 'partners' check (visibility in ('private','partners')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.certificate_files (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  organization_name text not null,
  certificate_type_name text not null,
  storage_path text not null unique,
  original_file_name text not null,
  mime_type text not null default 'application/pdf' check (mime_type='application/pdf'),
  file_size_bytes bigint not null check (file_size_bytes>0 and file_size_bytes<=26214400),
  version_number integer not null default 1 check (version_number>0),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint certificate_file_version_unique unique (certificate_id,version_number)
);

create table if not exists public.relationship_requirements (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.organization_relationships(id) on delete cascade,
  requester_organization_id uuid not null references public.organizations(id) on delete cascade,
  requester_organization_name text not null,
  partner_organization_id uuid not null references public.organizations(id) on delete cascade,
  partner_organization_name text not null,
  certificate_type_id uuid references public.certificate_types(id) on delete set null,
  certificate_type_code text not null,
  certificate_type_name text not null,
  required boolean not null default true,
  due_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint relationship_requirement_unique unique (relationship_id,certificate_type_code)
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  organization_name text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  expiry_notifications boolean not null default true,
  relationship_notifications boolean not null default true,
  certificate_change_notifications boolean not null default true,
  warning_days integer[] not null default array[60,30,15,7,1],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_unique unique (organization_id,user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  organization_name text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  severity text not null default 'info' check (severity in ('info','warning','critical','success')),
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  organization_name text,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  entity_name text,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  organization_name text,
  user_id uuid references auth.users(id) on delete set null,
  recipient_email text not null,
  recipient_name text,
  template_key text not null,
  subject text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','cancelled')),
  attempts integer not null default 0,
  provider_message_id text,
  last_error text,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint platform_admins_user_unique unique(user_id),
  constraint platform_admins_email_unique unique(email)
);

create index if not exists organizations_vat_idx on public.organizations(vat_number);
create index if not exists organization_members_user_idx on public.organization_members(user_id);
create index if not exists organization_members_org_idx on public.organization_members(organization_id);
create index if not exists relationships_requester_idx on public.organization_relationships(requester_organization_id);
create index if not exists relationships_partner_idx on public.organization_relationships(partner_organization_id);
create index if not exists certificates_organization_idx on public.certificates(organization_id);
create index if not exists certificates_type_idx on public.certificates(certificate_type_id);
create index if not exists certificates_expiry_idx on public.certificates(expiry_date);
create index if not exists certificate_files_certificate_idx on public.certificate_files(certificate_id);
create index if not exists relationship_requirements_relationship_idx on public.relationship_requirements(relationship_id);
create index if not exists relationship_requirements_partner_idx on public.relationship_requirements(partner_organization_id);
create index if not exists relationship_requirements_type_idx on public.relationship_requirements(certificate_type_id);
create index if not exists notifications_user_idx on public.notifications(user_id);
create index if not exists notifications_org_idx on public.notifications(organization_id);
create index if not exists notifications_unread_idx on public.notifications(user_id,read_at);
create index if not exists audit_log_org_idx on public.audit_log(organization_id);
create index if not exists audit_log_actor_idx on public.audit_log(actor_user_id);
create index if not exists audit_log_entity_idx on public.audit_log(entity_type,entity_id);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);
create index if not exists email_outbox_status_idx on public.email_outbox(status,available_at);
commit;
