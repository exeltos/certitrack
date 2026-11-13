-- =============================================================================
-- CertiTrack — peer network baseline schema
-- =============================================================================
--
-- Model
-- -----
-- * Every organization is an equal peer. There are no "suppliers" or
--   "customers": two organizations connect, and once the connection is active
--   neither side has more rights than the other.
-- * Access is NEVER transitive. If A is connected to B and B to C, A sees
--   nothing of C and cannot even learn that B and C are connected.
-- * Each organization decides, per certificate, who may see it:
--     private          -> only its own members
--     all_connections  -> every organization it is actively connected to
--     selected         -> only the organizations listed in certificate_shares
--                         (each share may carry its own expiry date)
-- * Either side can ask the other for a type of certificate (document
--   request). Each side manages only the requests it created.
-- * Partner views of certificate PDFs are logged, so owners can see who
--   opened what. Storage only serves a partner a PDF right after the view has
--   been logged (see ct_open_certificate + storage policy).
-- * Platform administrators (platform_admins) can see everything.
--
-- Conventions
-- -----------
-- * All writes that involve more than one organization go through
--   SECURITY DEFINER functions (prefix ct_). Clients only get direct write
--   access to a small, explicitly granted set of columns.
-- * Internal helper functions are not executable by clients.
--
-- This file creates the schema on an EMPTY public schema. To move an existing
-- project onto it, run supabase/reset/00_drop_previous_schema.sql first.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------
create function public.ct_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.ct_try_uuid(value text)
returns uuid language plpgsql immutable set search_path = public as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

create function public.ct_normalize_vat(value text)
returns text language sql immutable strict set search_path = public as $$
  select upper(regexp_replace(trim(value), '[^A-Za-z0-9]', '', 'g'))
$$;

-- -----------------------------------------------------------------------------
-- Organizations, members, platform admins
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null check (length(trim(legal_name)) > 0),
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
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closure_requested_at timestamptz,
  closure_requested_by uuid references auth.users(id) on delete set null,
  closure_reason text,
  suspended_at timestamptz,
  suspended_by uuid references auth.users(id) on delete set null,
  suspension_reason text,
  closed_at timestamptz,
  erasure_completed_at timestamptz,
  erasure_completed_by uuid references auth.users(id) on delete set null,
  constraint organizations_vat_not_blank check (length(ct_normalize_vat(vat_number)) > 0),
  constraint organizations_gr_vat_format check (country_code <> 'GR' or ct_normalize_vat(vat_number) ~ '^[0-9]{9}$')
);
create unique index organizations_country_vat_uq on public.organizations(country_code, ct_normalize_vat(vat_number));
create index organizations_contact_email_idx on public.organizations(lower(contact_email));
create trigger ct_touch_updated_at before update on public.organizations
  for each row execute function public.ct_touch_updated_at();

create table public.organization_members (
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
create index organization_members_user_idx on public.organization_members(user_id, status);
create trigger ct_touch_updated_at before update on public.organization_members
  for each row execute function public.ct_touch_updated_at();

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- -----------------------------------------------------------------------------
-- Certificates
-- -----------------------------------------------------------------------------
create table public.certificate_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,          -- Greek label (default UI language)
  name_en text not null,
  requires_expiry boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger ct_touch_updated_at before update on public.certificate_types
  for each row execute function public.ct_touch_updated_at();

insert into public.certificate_types(code, name, name_en, requires_expiry, sort_order) values
  ('ISO9001',             'ISO 9001',                  'ISO 9001',                 true, 10),
  ('ISO13485',            'ISO 13485',                 'ISO 13485',                true, 20),
  ('ISO14001',            'ISO 14001',                 'ISO 14001',                true, 30),
  ('ISO22000',            'ISO 22000',                 'ISO 22000',                true, 35),
  ('ISO27001',            'ISO 27001',                 'ISO 27001',                true, 40),
  ('ISO45001',            'ISO 45001',                 'ISO 45001',                true, 50),
  ('CE',                  'Πιστοποιητικό CE',          'CE certificate',           true, 60),
  ('OPERATING_LICENSE',   'Άδεια λειτουργίας',         'Operating license',        true, 70),
  ('INSURANCE',           'Ασφάλιση',                  'Insurance',                true, 80),
  ('INSURANCE_CLEARANCE', 'Ασφαλιστική ενημερότητα',   'Social security clearance',true, 90),
  ('TAX_CLEARANCE',       'Φορολογική ενημερότητα',    'Tax clearance',            true, 100),
  ('OTHER',               'Άλλο',                      'Other',                    false, 1000);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  certificate_type_id uuid not null references public.certificate_types(id),
  custom_type_label text,
  title text not null check (length(trim(title)) > 0),
  certificate_number text,
  issuer text,
  issue_date date,
  expiry_date date,
  notes text,
  sharing text not null default 'all_connections'
    check (sharing in ('private','all_connections','selected')),
  current_file_id uuid,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  constraint certificates_dates_check check (issue_date is null or expiry_date is null or expiry_date >= issue_date)
);
create index certificates_org_expiry_idx on public.certificates(organization_id, expiry_date) where deleted_at is null;
create index certificates_org_type_idx on public.certificates(organization_id, certificate_type_id) where deleted_at is null;

create function public.ct_certificates_before_write()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  if tg_op = 'UPDATE' then
    -- Defence in depth: column grants already prevent clients from touching these.
    new.organization_id := old.organization_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
create trigger ct_certificates_before_write before insert or update on public.certificates
  for each row execute function public.ct_certificates_before_write();

create table public.certificate_files (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  storage_path text not null unique,
  original_file_name text not null,
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 26214400),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  unique (certificate_id, version_no)
);
create index certificate_files_cert_idx on public.certificate_files(certificate_id, version_no desc);
alter table public.certificates
  add constraint certificates_current_file_fk foreign key (current_file_id)
  references public.certificate_files(id) on delete set null;

-- -----------------------------------------------------------------------------
-- Connections between peers
-- -----------------------------------------------------------------------------
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_org_id uuid not null references public.organizations(id) on delete cascade,
  addressee_org_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','active','declined','cancelled','ended')),
  requested_by uuid references auth.users(id) on delete set null,
  responded_by uuid references auth.users(id) on delete set null,
  responded_at timestamptz,
  ended_by uuid references auth.users(id) on delete set null,
  ended_by_org_id uuid references public.organizations(id) on delete set null,
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_org_id <> addressee_org_id)
);
-- At most one live (pending/active) connection per unordered pair.
create unique index connections_live_pair_uq on public.connections(
  least(requester_org_id, addressee_org_id), greatest(requester_org_id, addressee_org_id)
) where status in ('pending','active');
create index connections_requester_idx on public.connections(requester_org_id, status);
create index connections_addressee_idx on public.connections(addressee_org_id, status);
create trigger ct_touch_updated_at before update on public.connections
  for each row execute function public.ct_touch_updated_at();

-- Invitations by email to organizations that are not registered yet. When an
-- organization registers with that email, the invitation becomes a pending
-- connection automatically.
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  status text not null default 'pending' check (status in ('pending','converted','cancelled','expired')),
  invited_by uuid references auth.users(id) on delete set null,
  connection_id uuid references public.connections(id) on delete set null,
  expires_at timestamptz not null default now() + interval '60 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index invitations_pending_uq on public.invitations(inviter_org_id, lower(email)) where status = 'pending';
create index invitations_email_idx on public.invitations(lower(email)) where status = 'pending';
create trigger ct_touch_updated_at before update on public.invitations
  for each row execute function public.ct_touch_updated_at();

-- Certificates shared with specific connected organizations (sharing='selected').
create table public.certificate_shares (
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  grantee_org_id uuid not null references public.organizations(id) on delete cascade,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (certificate_id, grantee_org_id)
);
create index certificate_shares_grantee_idx on public.certificate_shares(grantee_org_id);

-- One organization asking a connected organization for a type of certificate.
create table public.document_requests (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  requester_org_id uuid not null references public.organizations(id) on delete cascade,
  responder_org_id uuid not null references public.organizations(id) on delete cascade,
  certificate_type_id uuid not null references public.certificate_types(id),
  note text,
  due_date date,
  status text not null default 'open' check (status in ('open','fulfilled','declined','cancelled')),
  fulfilled_certificate_id uuid references public.certificates(id) on delete set null,
  response_note text,
  created_by uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_org_id <> responder_org_id)
);
create unique index document_requests_live_uq on public.document_requests(connection_id, requester_org_id, certificate_type_id)
  where status in ('open','fulfilled');
create index document_requests_responder_idx on public.document_requests(responder_org_id, status);
create index document_requests_requester_idx on public.document_requests(requester_org_id, status);
create trigger ct_touch_updated_at before update on public.document_requests
  for each row execute function public.ct_touch_updated_at();

-- Who opened which certificate PDF. Written only by ct_open_certificate.
create table public.certificate_views (
  id bigint generated always as identity primary key,
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  file_id uuid references public.certificate_files(id) on delete set null,
  owner_org_id uuid not null references public.organizations(id) on delete cascade,
  viewer_org_id uuid references public.organizations(id) on delete set null,
  viewer_org_name text not null,   -- snapshot: stays readable after the connection ends
  viewer_user_id uuid references auth.users(id) on delete set null,
  viewed_at timestamptz not null default now()
);
create index certificate_views_owner_idx on public.certificate_views(owner_org_id, viewed_at desc);
create index certificate_views_recent_idx on public.certificate_views(viewer_user_id, file_id, viewed_at desc);

-- -----------------------------------------------------------------------------
-- Notifications, email outbox, audit, rate limiting
-- -----------------------------------------------------------------------------
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  expiry_in_app_enabled boolean not null default true,
  expiry_email_enabled boolean not null default true,
  expiry_warning_days integer[] not null default array[90,60,30,15,7,0],
  relationship_notifications boolean not null default true,
  partner_certificate_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  check (expiry_warning_days <@ array[0,1,3,7,14,15,30,45,60,90,120,180,365])
);
create trigger ct_touch_updated_at before update on public.notification_preferences
  for each row execute function public.ct_touch_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'certificate_expiry','certificate_expired',
    'connection_request','connection_accepted','connection_declined','connection_ended',
    'document_request','document_request_fulfilled','document_request_declined',
    'partner_certificate_expiring','partner_certificate_expired','partner_certificate_renewed',
    'system')),
  severity text not null default 'info' check (severity in ('info','warning','critical','success')),
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index notifications_dedupe_uq on public.notifications(user_id, dedupe_key) where dedupe_key is not null;
create index notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  recipient_email text not null,
  template_key text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  provider_message_id text,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_outbox_pending_idx on public.email_outbox(status, next_attempt_at) where status in ('pending','failed');
create trigger ct_touch_updated_at before update on public.email_outbox
  for each row execute function public.ct_touch_updated_at();

create table public.audit_log (
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
create index audit_log_org_time_idx on public.audit_log(organization_id, created_at desc);

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  bucket_key text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_bucket_idx on public.rate_limit_events(bucket_key, created_at desc);

-- =============================================================================
-- Access helpers
-- =============================================================================
create function public.ct_is_platform_admin(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and exists(select 1 from public.platform_admins where user_id = p_user)
$$;

-- Organization can take part in the network (sharing, connecting).
create function public.ct_is_org_operational(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.organizations
                where id = p_org and status in ('active','closure_requested'))
$$;

create function public.ct_is_org_member(p_org uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and exists(
    select 1 from public.organization_members
    where organization_id = p_org and user_id = p_user and status = 'active')
$$;

-- Active member with one of the roles, in an organization that is operational.
create function public.ct_has_org_role(p_org uuid, p_roles text[], p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null
     and ct_is_org_operational(p_org)
     and exists(select 1 from public.organization_members
                where organization_id = p_org and user_id = p_user
                  and status = 'active' and role = any(p_roles))
$$;

create function public.ct_current_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.organization_members
  where user_id = auth.uid() and status = 'active'
$$;

-- Active connection between two operational organizations.
create function public.ct_are_connected(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.connections c
    where c.status = 'active'
      and ((c.requester_org_id = p_a and c.addressee_org_id = p_b)
        or (c.requester_org_id = p_b and c.addressee_org_id = p_a)))
    and ct_is_org_operational(p_a) and ct_is_org_operational(p_b)
$$;

-- Any pending or active connection (used so both sides can see each other's
-- public card while a request is pending).
create function public.ct_have_live_connection(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.connections c
    where c.status in ('pending','active')
      and ((c.requester_org_id = p_a and c.addressee_org_id = p_b)
        or (c.requester_org_id = p_b and c.addressee_org_id = p_a)))
$$;

-- THE sharing rule. Can organization p_viewer (as a partner, not as owner) see
-- certificate p_certificate? Direct connection only — never transitive.
create function public.ct_org_can_view_certificate(p_viewer uuid, p_certificate uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.certificates c
    where c.id = p_certificate
      and c.deleted_at is null
      and c.organization_id <> p_viewer
      and c.sharing <> 'private'
      and ct_are_connected(p_viewer, c.organization_id)
      and (c.sharing = 'all_connections'
           or exists(select 1 from public.certificate_shares s
                     where s.certificate_id = c.id and s.grantee_org_id = p_viewer
                       and (s.expires_at is null or s.expires_at > now()))))
$$;

-- Can the current user see the certificate (as owner member, partner or admin)?
create function public.ct_can_view_certificate(p_certificate uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select ct_is_platform_admin()
      or exists(select 1 from public.certificates c
                where c.id = p_certificate and c.deleted_at is null and ct_is_org_member(c.organization_id))
      or exists(select 1 from ct_current_org_ids() me where ct_org_can_view_certificate(me, p_certificate))
$$;

-- Did the current user open this file through ct_open_certificate in the last 10 minutes?
create function public.ct_recently_opened(p_file uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.certificate_views
                where viewer_user_id = auth.uid() and file_id = p_file
                  and viewed_at > now() - interval '10 minutes')
$$;

-- =============================================================================
-- Internal helpers (not callable by clients)
-- =============================================================================
create function public.ct_write_audit(
  p_org uuid, p_action text, p_entity_type text, p_entity_id text,
  p_old jsonb default null, p_new jsonb default null, p_metadata jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id, old_data, new_data, metadata)
  values (p_org, auth.uid(), p_action, p_entity_type, p_entity_id, p_old, p_new, coalesce(p_metadata, '{}'::jsonb))
$$;

create function public.ct_org_name(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(display_name,''), legal_name, 'Οργανισμός') from public.organizations where id = p_org
$$;

-- Notify the owners/admins of an organization (in-app + optional email).
-- p_category: 'relationship' | 'partner_certificate' | 'expiry' | 'system'
create function public.ct_notify_org(
  p_org uuid, p_type text, p_severity text, p_title text, p_body text,
  p_entity_type text, p_entity_id uuid, p_dedupe text, p_category text,
  p_metadata jsonb default '{}'::jsonb, p_email_template text default null)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.notifications(organization_id, user_id, type, severity, title, body,
                                   entity_type, entity_id, dedupe_key, metadata)
  select p_org, m.user_id, p_type, p_severity, p_title, p_body, p_entity_type, p_entity_id,
         p_dedupe || ':' || m.user_id::text, coalesce(p_metadata, '{}'::jsonb)
  from public.organization_members m
  left join public.notification_preferences np on np.organization_id = m.organization_id and np.user_id = m.user_id
  where m.organization_id = p_org and m.status = 'active' and m.role in ('owner','admin')
    and coalesce(np.in_app_enabled, true)
    and case p_category
          when 'relationship' then coalesce(np.relationship_notifications, true)
          when 'partner_certificate' then coalesce(np.partner_certificate_notifications, true)
          when 'expiry' then coalesce(np.expiry_in_app_enabled, true)
          else true end
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  if p_email_template is not null then
    insert into public.email_outbox(organization_id, user_id, recipient_email, template_key, subject, payload, dedupe_key)
    select p_org, m.user_id, u.email, p_email_template, 'CertiTrack — ' || p_title,
           coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('title', p_title, 'body', p_body),
           'email:' || p_dedupe || ':' || m.user_id::text
    from public.organization_members m
    join auth.users u on u.id = m.user_id
    left join public.notification_preferences np on np.organization_id = m.organization_id and np.user_id = m.user_id
    where m.organization_id = p_org and m.status = 'active' and m.role in ('owner','admin')
      and u.email is not null
      and coalesce(np.email_enabled, true)
      and case p_category
            when 'relationship' then coalesce(np.relationship_notifications, true)
            when 'partner_certificate' then coalesce(np.partner_certificate_notifications, true)
            when 'expiry' then coalesce(np.expiry_email_enabled, true)
            else true end
    on conflict (dedupe_key) do nothing;
  end if;
end;
$$;

create function public.ct_check_rate_limit(p_bucket_key text, p_max_count int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  delete from public.rate_limit_events where created_at < now() - interval '1 day';
  select count(*) into v_count from public.rate_limit_events
   where bucket_key = p_bucket_key and created_at > now() - make_interval(secs => p_window_seconds);
  if v_count >= p_max_count then return false; end if;
  insert into public.rate_limit_events(bucket_key) values (p_bucket_key);
  return true;
end;
$$;

-- Mark open document requests as fulfilled when the requester can now see a
-- matching certificate, and tell the requester.
create function public.ct_refresh_requests_for_certificate(p_certificate uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.certificates; r public.document_requests;
begin
  select * into c from public.certificates where id = p_certificate;
  if c.id is null or c.deleted_at is not null then return; end if;
  for r in
    select * from public.document_requests
    where responder_org_id = c.organization_id and certificate_type_id = c.certificate_type_id
      and status = 'open' and ct_org_can_view_certificate(requester_org_id, c.id)
    for update
  loop
    update public.document_requests
       set status = 'fulfilled', fulfilled_certificate_id = c.id,
           resolved_by = auth.uid(), resolved_at = now()
     where id = r.id;
    perform ct_notify_org(r.requester_org_id, 'document_request_fulfilled', 'success',
      'Το αίτημα εγγράφου ικανοποιήθηκε',
      ct_org_name(c.organization_id) || ' κοινοποίησε: ' || c.title || '.',
      'document_request', r.id, 'document-request-fulfilled:' || r.id::text, 'partner_certificate',
      jsonb_build_object('certificate_id', c.id, 'certificate_title', c.title,
                         'partner_name', ct_org_name(c.organization_id)),
      'document_request_fulfilled');
  end loop;
end;
$$;

-- =============================================================================
-- Triggers: audit, certificate side effects, signup
-- =============================================================================
create function public.ct_audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_orgs uuid[];
  v_org uuid;
begin
  v_orgs := case tg_table_name
    when 'organizations' then array[(v_row->>'id')::uuid]
    when 'connections' then array[(v_row->>'requester_org_id')::uuid, (v_row->>'addressee_org_id')::uuid]
    when 'document_requests' then array[(v_row->>'requester_org_id')::uuid, (v_row->>'responder_org_id')::uuid]
    when 'certificate_shares' then array[(select organization_id from public.certificates
                                          where id = (v_row->>'certificate_id')::uuid)]
    else array[(v_row->>'organization_id')::uuid]
  end;
  foreach v_org in array v_orgs loop
    insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id, old_data, new_data)
    values (v_org, auth.uid(), lower(tg_op), tg_table_name,
            coalesce(v_row->>'id', v_row->>'certificate_id'),
            case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
            case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  end loop;
  return null;
end;
$$;

create trigger ct_audit after update on public.organizations
  for each row execute function public.ct_audit_row_change();
create trigger ct_audit after insert or update or delete on public.organization_members
  for each row execute function public.ct_audit_row_change();
create trigger ct_audit after insert or update or delete on public.certificates
  for each row execute function public.ct_audit_row_change();
create trigger ct_audit after insert or update or delete on public.certificate_files
  for each row execute function public.ct_audit_row_change();
create trigger ct_audit after insert or delete on public.certificate_shares
  for each row execute function public.ct_audit_row_change();
create trigger ct_audit after insert or update or delete on public.connections
  for each row execute function public.ct_audit_row_change();
create trigger ct_audit after insert or update or delete on public.document_requests
  for each row execute function public.ct_audit_row_change();

-- After a certificate changes: fulfil matching requests, tell partners about renewals.
create function public.ct_certificates_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.deleted_at is not null then return null; end if;
  perform ct_refresh_requests_for_certificate(new.id);

  if tg_op = 'UPDATE' and new.expiry_date is not null
     and (old.expiry_date is null or new.expiry_date > old.expiry_date) then
    for r in
      select distinct dr.requester_org_id
      from public.document_requests dr
      where dr.responder_org_id = new.organization_id
        and dr.certificate_type_id = new.certificate_type_id
        and dr.status in ('open','fulfilled')
        and ct_org_can_view_certificate(dr.requester_org_id, new.id)
    loop
      perform ct_notify_org(r.requester_org_id, 'partner_certificate_renewed', 'success',
        'Ανανεώθηκε πιστοποιητικό συνεργάτη',
        ct_org_name(new.organization_id) || ': ' || new.title || ' ισχύει έως ' || to_char(new.expiry_date, 'DD/MM/YYYY') || '.',
        'certificate', new.id,
        'partner-renewed:' || new.id::text || ':' || r.requester_org_id::text || ':' || new.expiry_date::text,
        'partner_certificate',
        jsonb_build_object('certificate_id', new.id, 'certificate_title', new.title,
                           'expiry_date', new.expiry_date, 'partner_name', ct_org_name(new.organization_id)),
        'partner_certificate_renewed');
    end loop;
  end if;
  return null;
end;
$$;
create trigger ct_certificates_after_write after insert or update on public.certificates
  for each row execute function public.ct_certificates_after_write();

-- Turn pending email invitations for this organization into pending connections.
create function public.ct_convert_invitations(p_org uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare inv public.invitations; v_conn uuid;
begin
  if p_email is null then return; end if;
  for inv in
    select * from public.invitations
    where status = 'pending' and lower(email) = lower(p_email) and expires_at > now()
      and inviter_org_id <> p_org and ct_is_org_operational(inviter_org_id)
    for update
  loop
    if ct_have_live_connection(inv.inviter_org_id, p_org) then
      update public.invitations set status = 'converted' where id = inv.id;
      continue;
    end if;
    insert into public.connections(requester_org_id, addressee_org_id, requested_by)
    values (inv.inviter_org_id, p_org, inv.invited_by)
    returning id into v_conn;
    update public.invitations set status = 'converted', connection_id = v_conn where id = inv.id;
    perform ct_notify_org(p_org, 'connection_request', 'info', 'Νέο αίτημα σύνδεσης',
      ct_org_name(inv.inviter_org_id) || ' θέλει να συνδεθεί μαζί σας στο CertiTrack.',
      'connection', v_conn, 'connection-request:' || v_conn::text, 'relationship',
      jsonb_build_object('partner_name', ct_org_name(inv.inviter_org_id)));
  end loop;
end;
$$;

create function public.ct_activate_user_organizations(p_user uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  update public.organization_members set status = 'active'
   where user_id = p_user and status = 'pending_verification';
  for v_org in
    update public.organizations o set status = 'active'
     where o.status = 'pending_verification'
       and exists(select 1 from public.organization_members m
                  where m.organization_id = o.id and m.user_id = p_user and m.role = 'owner')
    returning o.id
  loop
    perform ct_convert_invitations(v_org, p_email);
    perform ct_convert_invitations(v_org, (select contact_email from public.organizations where id = v_org));
  end loop;
end;
$$;

-- Organization sign-up: user metadata {type:'organization', name, afm, country_code}.
-- Users without type='organization' (e.g. platform admins) get no organization.
create function public.ct_handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_country text := upper(coalesce(nullif(new.raw_user_meta_data->>'country_code',''), 'GR'));
  v_vat text := ct_normalize_vat(new.raw_user_meta_data->>'afm');
  v_name text := nullif(trim(new.raw_user_meta_data->>'name'), '');
  v_state text := case when new.email_confirmed_at is null then 'pending_verification' else 'active' end;
begin
  if coalesce(new.raw_user_meta_data->>'type', '') <> 'organization' then return new; end if;
  if v_name is null or v_vat is null then raise exception 'Organization name and VAT number are required'; end if;

  insert into organizations(legal_name, display_name, country_code, vat_number, contact_email, status, created_by)
  values (v_name, v_name, v_country, v_vat, new.email, 'pending_verification', new.id)
  returning id into v_org;
  insert into organization_members(organization_id, user_id, role, status)
  values (v_org, new.id, 'owner', 'pending_verification');
  insert into notification_preferences(organization_id, user_id) values (v_org, new.id);

  if v_state = 'active' then perform ct_activate_user_organizations(new.id, new.email); end if;
  return new;
exception when unique_violation then
  raise exception 'An organization with this VAT number already exists';
end;
$$;

create function public.ct_handle_auth_user_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform ct_activate_user_organizations(new.id, new.email);
  end if;
  return new;
end;
$$;

create trigger ct_on_auth_user_created after insert on auth.users
  for each row execute function public.ct_handle_new_auth_user();
create trigger ct_on_auth_user_verified after update of email_confirmed_at on auth.users
  for each row execute function public.ct_handle_auth_user_verified();

-- =============================================================================
-- Client RPCs — connections
-- =============================================================================

-- Exact lookup by VAT number or contact email. Returns only a public card.
create function public.ct_find_partner_candidate(p_lookup text)
returns table(id uuid, name text, vat_number text, country_code text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query
  select o.id, coalesce(nullif(o.display_name,''), o.legal_name), o.vat_number, o.country_code
  from public.organizations o
  where o.status = 'active'
    and (lower(o.contact_email) = lower(trim(p_lookup))
         or ct_normalize_vat(o.vat_number) = ct_normalize_vat(p_lookup))
  limit 1;
end;
$$;

-- Connect with a registered organization (by VAT/email) or invite by email.
-- Returns {kind:'connection'|'invitation', id}.
create function public.ct_request_connection(p_org uuid, p_lookup text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_term text := lower(trim(coalesce(p_lookup, '')));
  v_target uuid;
  v_conn uuid;
  v_inv uuid;
begin
  if not ct_has_org_role(p_org, array['owner','admin','member']) then raise exception 'Insufficient permission'; end if;
  if v_term = '' then raise exception 'VAT or email is required'; end if;
  if not ct_check_rate_limit('connect:' || auth.uid()::text, 30, 3600) then
    raise exception 'Too many connection requests. Try again later';
  end if;

  select o.id into v_target from public.organizations o
  where o.status = 'active'
    and (lower(o.contact_email) = v_term or ct_normalize_vat(o.vat_number) = ct_normalize_vat(v_term))
  limit 1;

  if v_target is not null then
    if v_target = p_org then raise exception 'Cannot connect with your own organization'; end if;
    if ct_have_live_connection(p_org, v_target) then raise exception 'Connection already exists or is pending'; end if;
    insert into public.connections(requester_org_id, addressee_org_id, requested_by)
    values (p_org, v_target, auth.uid()) returning id into v_conn;
    perform ct_notify_org(v_target, 'connection_request', 'info', 'Νέο αίτημα σύνδεσης',
      ct_org_name(p_org) || ' θέλει να συνδεθεί μαζί σας στο CertiTrack.',
      'connection', v_conn, 'connection-request:' || v_conn::text, 'relationship',
      jsonb_build_object('partner_name', ct_org_name(p_org)), 'connection_request');
    return jsonb_build_object('kind', 'connection', 'id', v_conn);
  end if;

  if position('@' in v_term) = 0 then
    raise exception 'No registered organization was found. Use an email address to invite an unregistered organization';
  end if;
  insert into public.invitations(inviter_org_id, email, invited_by)
  values (p_org, v_term, auth.uid())
  on conflict (inviter_org_id, lower(email)) where status = 'pending'
  do update set expires_at = now() + interval '60 days'
  returning id into v_inv;
  insert into public.email_outbox(organization_id, recipient_email, template_key, subject, payload, dedupe_key)
  values (p_org, v_term, 'connection_invitation', 'CertiTrack — Πρόσκληση σύνδεσης',
          jsonb_build_object('partner_name', ct_org_name(p_org)), 'invitation:' || v_inv::text)
  on conflict (dedupe_key) do nothing;
  return jsonb_build_object('kind', 'invitation', 'id', v_inv);
end;
$$;

create function public.ct_respond_connection(p_connection uuid, p_accept boolean)
returns public.connections language plpgsql security definer set search_path = public as $$
declare c public.connections;
begin
  select * into c from public.connections where id = p_connection for update;
  if c.id is null then raise exception 'Connection not found'; end if;
  if c.status <> 'pending' then raise exception 'Connection is not pending'; end if;
  if not ct_has_org_role(c.addressee_org_id, array['owner','admin']) then
    raise exception 'Only an owner/admin of the invited organization may respond';
  end if;
  update public.connections
     set status = case when p_accept then 'active' else 'declined' end,
         responded_by = auth.uid(), responded_at = now()
   where id = p_connection returning * into c;
  perform ct_notify_org(c.requester_org_id,
    case when p_accept then 'connection_accepted' else 'connection_declined' end,
    case when p_accept then 'success' else 'warning' end,
    case when p_accept then 'Η σύνδεση ενεργοποιήθηκε' else 'Το αίτημα σύνδεσης απορρίφθηκε' end,
    ct_org_name(c.addressee_org_id) ||
      case when p_accept then ' αποδέχθηκε το αίτημα σύνδεσης.' else ' απέρριψε το αίτημα σύνδεσης.' end,
    'connection', c.id, 'connection-response:' || c.id::text, 'relationship',
    jsonb_build_object('partner_name', ct_org_name(c.addressee_org_id)),
    case when p_accept then 'connection_accepted' end);
  return c;
end;
$$;

-- Either side can end an active connection; the requester can cancel a pending
-- one. Access stops immediately and per-organization shares and open requests
-- between the two are removed, so reconnecting later starts from a clean slate.
create function public.ct_end_connection(p_connection uuid, p_reason text default null)
returns public.connections language plpgsql security definer set search_path = public as $$
declare c public.connections; v_me uuid; v_other uuid;
begin
  select * into c from public.connections where id = p_connection for update;
  if c.id is null then raise exception 'Connection not found'; end if;
  if ct_has_org_role(c.requester_org_id, array['owner','admin']) then v_me := c.requester_org_id; v_other := c.addressee_org_id;
  elsif ct_has_org_role(c.addressee_org_id, array['owner','admin']) then v_me := c.addressee_org_id; v_other := c.requester_org_id;
  else raise exception 'Insufficient permission'; end if;

  if c.status = 'pending' then
    if v_me <> c.requester_org_id then raise exception 'Use respond to decline a pending request'; end if;
    update public.connections set status = 'cancelled', ended_by = auth.uid(), ended_by_org_id = v_me, ended_at = now()
     where id = c.id returning * into c;
    return c;
  end if;
  if c.status <> 'active' then raise exception 'Connection is not active'; end if;

  update public.connections
     set status = 'ended', ended_by = auth.uid(), ended_by_org_id = v_me, ended_at = now(),
         end_reason = nullif(trim(p_reason), '')
   where id = c.id returning * into c;
  delete from public.certificate_shares s using public.certificates ce
   where ce.id = s.certificate_id
     and ((ce.organization_id = v_me and s.grantee_org_id = v_other)
       or (ce.organization_id = v_other and s.grantee_org_id = v_me));
  update public.document_requests set status = 'cancelled', resolved_at = now(), resolved_by = auth.uid()
   where connection_id = c.id and status in ('open','fulfilled');
  perform ct_notify_org(v_other, 'connection_ended', 'warning', 'Η σύνδεση τερματίστηκε',
    ct_org_name(v_me) || ' τερμάτισε τη σύνδεση. Δεν βλέπετε πλέον ο ένας τα έγγραφα του άλλου.',
    'connection', c.id, 'connection-ended:' || c.id::text || ':' || extract(epoch from c.ended_at)::bigint, 'relationship',
    jsonb_build_object('partner_name', ct_org_name(v_me)));
  return c;
end;
$$;

create function public.ct_cancel_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = public as $$
declare inv public.invitations;
begin
  select * into inv from public.invitations where id = p_invitation for update;
  if inv.id is null then return; end if;
  if not ct_has_org_role(inv.inviter_org_id, array['owner','admin','member']) then raise exception 'Insufficient permission'; end if;
  update public.invitations set status = 'cancelled' where id = inv.id and status = 'pending';
end;
$$;

-- My connections with the other side's public card. Never exposes anything
-- about the other side's own connections.
create function public.ct_list_connections(p_org uuid)
returns table(
  id uuid, status text, direction text, created_at timestamptz, responded_at timestamptz, ended_at timestamptz,
  partner_id uuid, partner_name text, partner_vat text, partner_country text, partner_email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (ct_is_org_member(p_org) or ct_is_platform_admin()) then raise exception 'Insufficient permission'; end if;
  return query
  select c.id, c.status,
         case when c.requester_org_id = p_org then 'outgoing' else 'incoming' end,
         c.created_at, c.responded_at, c.ended_at,
         o.id, coalesce(nullif(o.display_name,''), o.legal_name), o.vat_number, o.country_code, o.contact_email
  from public.connections c
  join public.organizations o
    on o.id = case when c.requester_org_id = p_org then c.addressee_org_id else c.requester_org_id end
  where p_org in (c.requester_org_id, c.addressee_org_id)
    and c.status in ('pending','active')
  order by c.status, c.created_at desc;
end;
$$;

-- =============================================================================
-- Client RPCs — certificates
-- =============================================================================

-- Set who can see a certificate.
--   p_mode   : 'private' | 'all_connections' | 'selected'
--   p_shares : for 'selected', [{"org_id": "...", "expires_at": "2027-01-01T00:00:00Z" | null}, ...]
create function public.ct_set_certificate_sharing(p_certificate uuid, p_mode text, p_shares jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare c public.certificates; s jsonb; v_org uuid; v_exp timestamptz;
begin
  select * into c from public.certificates where id = p_certificate and deleted_at is null for update;
  if c.id is null then raise exception 'Certificate not found'; end if;
  if not ct_has_org_role(c.organization_id, array['owner','admin','member']) then raise exception 'Insufficient permission'; end if;
  if p_mode not in ('private','all_connections','selected') then raise exception 'Invalid sharing mode'; end if;

  delete from public.certificate_shares where certificate_id = c.id;
  if p_mode = 'selected' then
    for s in select * from jsonb_array_elements(coalesce(p_shares, '[]'::jsonb)) loop
      v_org := (s->>'org_id')::uuid;
      v_exp := nullif(s->>'expires_at', '')::timestamptz;
      if not ct_are_connected(c.organization_id, v_org) then
        raise exception 'Can only share with organizations you are connected to';
      end if;
      if v_exp is not null and v_exp <= now() then raise exception 'Share expiry must be in the future'; end if;
      insert into public.certificate_shares(certificate_id, grantee_org_id, expires_at, created_by)
      values (c.id, v_org, v_exp, auth.uid());
    end loop;
  end if;
  update public.certificates set sharing = p_mode where id = c.id;
  -- The update trigger refreshes document requests; call again in case only shares changed.
  perform ct_refresh_requests_for_certificate(c.id);
end;
$$;

create function public.ct_register_certificate_file(
  p_certificate uuid, p_storage_path text, p_original_file_name text, p_mime_type text, p_file_size_bytes bigint)
returns public.certificate_files language plpgsql security definer set search_path = public, storage as $$
declare c public.certificates; f public.certificate_files; v_version integer;
begin
  select * into c from public.certificates where id = p_certificate and deleted_at is null for update;
  if c.id is null then raise exception 'Certificate not found'; end if;
  if not ct_has_org_role(c.organization_id, array['owner','admin','member']) then raise exception 'Insufficient permission'; end if;
  if p_mime_type <> 'application/pdf' then raise exception 'Only PDF files are allowed'; end if;
  if p_file_size_bytes is null or p_file_size_bytes <= 0 or p_file_size_bytes > 26214400 then
    raise exception 'PDF size must be between 1 byte and 25 MB';
  end if;
  if split_part(p_storage_path, '/', 1) <> c.organization_id::text
     or split_part(p_storage_path, '/', 2) <> c.id::text then
    raise exception 'Invalid certificate storage path';
  end if;
  if not exists(select 1 from storage.objects o where o.bucket_id = 'organizationcertificates' and o.name = p_storage_path) then
    raise exception 'Uploaded PDF object was not found';
  end if;

  select coalesce(max(version_no), 0) + 1 into v_version from public.certificate_files where certificate_id = c.id;
  update public.certificate_files set retired_at = now() where certificate_id = c.id and retired_at is null;
  insert into public.certificate_files(certificate_id, organization_id, version_no, storage_path,
                                       original_file_name, mime_type, file_size_bytes, uploaded_by)
  values (c.id, c.organization_id, v_version, p_storage_path,
          coalesce(nullif(trim(p_original_file_name), ''), 'certificate.pdf'), p_mime_type, p_file_size_bytes, auth.uid())
  returning * into f;
  update public.certificates set current_file_id = f.id where id = c.id;
  return f;
end;
$$;

create function public.ct_soft_delete_certificate(p_certificate uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.certificates;
begin
  select * into c from public.certificates where id = p_certificate and deleted_at is null for update;
  if c.id is null then return; end if;
  if not ct_has_org_role(c.organization_id, array['owner','admin']) then
    raise exception 'Only organization owners/admins may delete certificates';
  end if;
  update public.certificates set deleted_at = now(), deleted_by = auth.uid() where id = c.id;
  delete from public.certificate_shares where certificate_id = c.id;
end;
$$;

-- Remove a certificate row whose PDF upload failed.
create function public.ct_abort_certificate_draft(p_certificate uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.certificates;
begin
  select * into c from public.certificates where id = p_certificate and deleted_at is null for update;
  if c.id is null then return; end if;
  if c.current_file_id is not null then raise exception 'Certificate already has a registered file'; end if;
  if c.created_by is distinct from auth.uid() then raise exception 'Insufficient permission'; end if;
  delete from public.certificates where id = c.id;
end;
$$;

-- Returns the current PDF path of a certificate the caller may see, and logs the
-- view when the caller is a partner. Storage only serves partners a PDF that was
-- opened through this function in the last 10 minutes.
create function public.ct_open_certificate(p_certificate uuid)
returns table(storage_path text, file_name text)
language plpgsql security definer set search_path = public as $$
declare c public.certificates; f public.certificate_files; v_viewer uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into c from public.certificates where id = p_certificate and deleted_at is null;
  if c.id is null then raise exception 'Certificate not found'; end if;
  select * into f from public.certificate_files where id = c.current_file_id;
  if f.id is null then raise exception 'Certificate has no file'; end if;

  if not (ct_is_org_member(c.organization_id) or ct_is_platform_admin()) then
    select me into v_viewer from ct_current_org_ids() me where ct_org_can_view_certificate(me, c.id) limit 1;
    if v_viewer is null then raise exception 'Certificate not found'; end if;
    insert into public.certificate_views(certificate_id, file_id, owner_org_id, viewer_org_id, viewer_org_name, viewer_user_id)
    values (c.id, f.id, c.organization_id, v_viewer, ct_org_name(v_viewer), auth.uid());
  end if;
  return query select f.storage_path, f.original_file_name;
end;
$$;

-- =============================================================================
-- Client RPCs — document requests
-- =============================================================================
create function public.ct_request_document(
  p_connection uuid, p_certificate_type uuid, p_note text default null, p_due_date date default null)
returns public.document_requests language plpgsql security definer set search_path = public as $$
declare c public.connections; v_me uuid; v_other uuid; r public.document_requests; v_type text;
begin
  select * into c from public.connections where id = p_connection and status = 'active';
  if c.id is null then raise exception 'Connection is not active'; end if;
  if ct_has_org_role(c.requester_org_id, array['owner','admin','member']) then v_me := c.requester_org_id; v_other := c.addressee_org_id;
  elsif ct_has_org_role(c.addressee_org_id, array['owner','admin','member']) then v_me := c.addressee_org_id; v_other := c.requester_org_id;
  else raise exception 'Insufficient permission'; end if;
  select name into v_type from public.certificate_types where id = p_certificate_type and active;
  if v_type is null then raise exception 'Unknown certificate type'; end if;

  insert into public.document_requests(connection_id, requester_org_id, responder_org_id, certificate_type_id,
                                        note, due_date, created_by)
  values (c.id, v_me, v_other, p_certificate_type, nullif(trim(p_note), ''), p_due_date, auth.uid())
  returning * into r;

  perform ct_notify_org(v_other, 'document_request', 'info', 'Νέο αίτημα εγγράφου',
    ct_org_name(v_me) || ' ζητά: ' || v_type || '.',
    'document_request', r.id, 'document-request:' || r.id::text, 'partner_certificate',
    jsonb_build_object('partner_name', ct_org_name(v_me), 'certificate_type', v_type, 'due_date', p_due_date),
    'document_request');

  -- Already satisfied by something the requester can see? Mark it immediately.
  perform ct_refresh_requests_for_certificate(ce.id)
  from public.certificates ce
  where ce.organization_id = v_other and ce.certificate_type_id = p_certificate_type and ce.deleted_at is null;

  select * into r from public.document_requests where id = r.id;
  return r;
exception when unique_violation then
  raise exception 'You have already requested this type of certificate from this organization';
end;
$$;

create function public.ct_cancel_document_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.document_requests;
begin
  select * into r from public.document_requests where id = p_request for update;
  if r.id is null then raise exception 'Request not found'; end if;
  if not ct_has_org_role(r.requester_org_id, array['owner','admin','member']) then
    raise exception 'Only the requesting organization may cancel its request';
  end if;
  update public.document_requests set status = 'cancelled', resolved_by = auth.uid(), resolved_at = now()
   where id = r.id and status in ('open','fulfilled');
end;
$$;

create function public.ct_decline_document_request(p_request uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.document_requests; v_type text;
begin
  select * into r from public.document_requests where id = p_request for update;
  if r.id is null then raise exception 'Request not found'; end if;
  if not ct_has_org_role(r.responder_org_id, array['owner','admin']) then raise exception 'Insufficient permission'; end if;
  if r.status <> 'open' then raise exception 'Request is not open'; end if;
  update public.document_requests
     set status = 'declined', response_note = nullif(trim(p_note), ''), resolved_by = auth.uid(), resolved_at = now()
   where id = r.id;
  select name into v_type from public.certificate_types where id = r.certificate_type_id;
  perform ct_notify_org(r.requester_org_id, 'document_request_declined', 'warning', 'Το αίτημα εγγράφου απορρίφθηκε',
    ct_org_name(r.responder_org_id) || ' απέρριψε το αίτημα για ' || v_type ||
      coalesce(': ' || nullif(trim(p_note), ''), '.'),
    'document_request', r.id, 'document-request-declined:' || r.id::text, 'partner_certificate',
    jsonb_build_object('partner_name', ct_org_name(r.responder_org_id), 'certificate_type', v_type));
end;
$$;

-- Answer a request with one of my certificates: makes sure the requester can see it.
create function public.ct_fulfill_document_request(p_request uuid, p_certificate uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.document_requests; c public.certificates;
begin
  select * into r from public.document_requests where id = p_request for update;
  if r.id is null then raise exception 'Request not found'; end if;
  if not ct_has_org_role(r.responder_org_id, array['owner','admin','member']) then raise exception 'Insufficient permission'; end if;
  if r.status <> 'open' then raise exception 'Request is not open'; end if;
  select * into c from public.certificates where id = p_certificate and organization_id = r.responder_org_id and deleted_at is null;
  if c.id is null then raise exception 'Certificate not found'; end if;
  if c.certificate_type_id <> r.certificate_type_id then raise exception 'Certificate type does not match the request'; end if;
  if c.current_file_id is null then raise exception 'Certificate has no PDF yet'; end if;

  if not ct_org_can_view_certificate(r.requester_org_id, c.id) then
    if c.sharing = 'private' then
      update public.certificates set sharing = 'selected' where id = c.id;
    end if;
    insert into public.certificate_shares(certificate_id, grantee_org_id, created_by)
    values (c.id, r.requester_org_id, auth.uid())
    on conflict (certificate_id, grantee_org_id) do update set expires_at = null;
  end if;
  perform ct_refresh_requests_for_certificate(c.id);
end;
$$;

-- =============================================================================
-- Client RPCs — notifications and organization lifecycle
-- =============================================================================
create function public.ct_set_notification_read(p_notification uuid, p_read boolean default true)
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = case when p_read then now() else null end
  where id = p_notification and user_id = auth.uid()
$$;

create function public.ct_mark_notifications_read(p_notifications uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.notifications set read_at = coalesce(read_at, now())
   where user_id = auth.uid() and id = any(coalesce(p_notifications, '{}'));
  get diagnostics n = row_count;
  return n;
end;
$$;

create function public.ct_request_organization_closure(p_org uuid, p_reason text default null)
returns public.organizations language plpgsql security definer set search_path = public as $$
declare o public.organizations;
begin
  if not ct_has_org_role(p_org, array['owner']) then raise exception 'Only an owner may request organization closure'; end if;
  update public.organizations
     set status = 'closure_requested', closure_requested_at = now(), closure_requested_by = auth.uid(),
         closure_reason = nullif(trim(p_reason), '')
   where id = p_org and status = 'active' returning * into o;
  if o.id is null then raise exception 'Organization is not active'; end if;
  return o;
end;
$$;

create function public.ct_cancel_organization_closure(p_org uuid)
returns public.organizations language plpgsql security definer set search_path = public as $$
declare o public.organizations;
begin
  if not ct_has_org_role(p_org, array['owner']) then raise exception 'Only an owner may cancel closure'; end if;
  update public.organizations
     set status = 'active', closure_requested_at = null, closure_requested_by = null, closure_reason = null
   where id = p_org and status = 'closure_requested' returning * into o;
  if o.id is null then raise exception 'No closure request is pending'; end if;
  return o;
end;
$$;

-- =============================================================================
-- Platform administration
-- =============================================================================
create function public.ct_platform_set_organization_state(p_org uuid, p_state text, p_reason text default null)
returns public.organizations language plpgsql security definer set search_path = public as $$
declare o public.organizations;
begin
  if not ct_is_platform_admin() then raise exception 'Platform administrator required'; end if;
  if p_state not in ('active','suspended','closed') then raise exception 'Invalid organization state'; end if;
  update public.organizations set
    status = p_state,
    suspended_at = case when p_state = 'suspended' then now() end,
    suspended_by = case when p_state = 'suspended' then auth.uid() end,
    suspension_reason = case when p_state = 'suspended' then nullif(trim(p_reason), '') end,
    closed_at = case when p_state = 'closed' then now() else closed_at end
  where id = p_org returning * into o;
  if o.id is null then raise exception 'Organization not found'; end if;
  if p_state = 'closed' then
    update public.organization_members set status = 'suspended' where organization_id = p_org and status = 'active';
    update public.connections set status = 'ended', ended_at = now(), ended_by = auth.uid(), end_reason = 'organization_closed'
     where status in ('pending','active') and p_org in (requester_org_id, addressee_org_id);
  elsif p_state = 'active' then
    update public.organization_members set status = 'active' where organization_id = p_org and status = 'suspended';
  end if;
  perform ct_write_audit(p_org, 'organization_' || p_state, 'organizations', p_org::text, null, to_jsonb(o),
                         jsonb_build_object('reason', p_reason));
  return o;
end;
$$;

-- Whole-network view for the platform owner: every connection with both names.
create function public.ct_admin_network()
returns table(
  connection_id uuid, status text, created_at timestamptz, responded_at timestamptz, ended_at timestamptz,
  requester_id uuid, requester_name text, addressee_id uuid, addressee_name text,
  shared_by_requester bigint, shared_by_addressee bigint, open_requests bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not ct_is_platform_admin() then raise exception 'Platform administrator required'; end if;
  return query
  select c.id, c.status, c.created_at, c.responded_at, c.ended_at,
         c.requester_org_id, ct_org_name(c.requester_org_id),
         c.addressee_org_id, ct_org_name(c.addressee_org_id),
         (select count(*) from public.certificates ce where ce.organization_id = c.requester_org_id
            and c.status = 'active' and ct_org_can_view_certificate(c.addressee_org_id, ce.id)),
         (select count(*) from public.certificates ce where ce.organization_id = c.addressee_org_id
            and c.status = 'active' and ct_org_can_view_certificate(c.requester_org_id, ce.id)),
         (select count(*) from public.document_requests dr where dr.connection_id = c.id and dr.status = 'open')
  from public.connections c
  order by c.created_at desc;
end;
$$;

-- Service role only (Netlify function finalize_account_erasure).
create function public.ct_finalize_erasure(p_org uuid)
returns public.organizations language plpgsql security definer set search_path = public as $$
declare o public.organizations;
begin
  select * into o from public.organizations where id = p_org for update;
  if o.id is null then raise exception 'Organization not found'; end if;
  if o.status <> 'closed' then raise exception 'Organization must be closed before erasure (current status: %)', o.status; end if;
  if o.erasure_completed_at is not null then raise exception 'Erasure already completed for this organization'; end if;
  update public.organizations set
    legal_name = 'Erased organization', display_name = 'Erased organization', contact_email = null, phone = null,
    website = null, address_line1 = null, address_line2 = null, city = null, postal_code = null,
    erasure_completed_at = now(), erasure_completed_by = auth.uid()
  where id = p_org returning * into o;
  perform ct_write_audit(p_org, 'erasure_completed', 'organizations', p_org::text, null,
                         jsonb_build_object('erased_at', o.erasure_completed_at));
  return o;
end;
$$;

-- =============================================================================
-- Scheduled jobs (service role only)
-- =============================================================================

-- Daily: expiry reminders for own certificates, and for certificates that a
-- partner asked for (so both sides know when a requested document lapses).
create function public.ct_generate_expiry_notifications(p_today date default current_date)
returns table(created_notifications integer, queued_emails integer)
language plpgsql security definer set search_path = public, auth as $$
declare
  n_before integer; e_before integer;
  x record;
  v_days integer;
begin
  select count(*) into n_before from public.notifications;
  select count(*) into e_before from public.email_outbox;

  -- Own certificates. The threshold used is the smallest configured warning day
  -- that is >= days remaining, so each threshold fires once.
  for x in
    select c.id, c.organization_id, c.title, c.expiry_date, (c.expiry_date - p_today) as days_left
    from public.certificates c
    where c.deleted_at is null and c.expiry_date is not null and ct_is_org_operational(c.organization_id)
  loop
    if x.days_left < 0 then
      perform ct_notify_org(x.organization_id, 'certificate_expired', 'critical', 'Ληγμένο πιστοποιητικό',
        x.title || ' έχει λήξει.', 'certificate', x.id, 'certificate-expired:' || x.id::text || ':' || x.expiry_date::text,
        'expiry', jsonb_build_object('certificate_id', x.id, 'certificate_title', x.title, 'expiry_date', x.expiry_date),
        'certificate_expired');
    else
      select min(w) into v_days from unnest(array[90,60,30,15,7,0]) w where w >= x.days_left;
      if v_days is not null then
        perform ct_notify_org(x.organization_id, 'certificate_expiry',
          case when v_days <= 7 then 'critical' when v_days <= 30 then 'warning' else 'info' end,
          case when x.days_left = 0 then 'Το πιστοποιητικό λήγει σήμερα' else 'Πιστοποιητικό προς λήξη' end,
          case when x.days_left = 0 then x.title || ' λήγει σήμερα.'
               else x.title || ' λήγει σε ' || x.days_left || ' ημέρες.' end,
          'certificate', x.id, 'certificate-expiry:' || x.id::text || ':' || x.expiry_date::text || ':' || v_days,
          'expiry', jsonb_build_object('certificate_id', x.id, 'certificate_title', x.title,
                                       'expiry_date', x.expiry_date, 'warning_days', v_days),
          'certificate_expiry');
      end if;
    end if;
  end loop;

  -- Partner certificates that were requested: tell the requester at 30/7/0 days
  -- and when expired, unless a newer valid certificate of the same type is visible.
  for x in
    select distinct on (dr.requester_org_id, c.id)
           dr.requester_org_id, c.id, c.organization_id, c.title, c.expiry_date, (c.expiry_date - p_today) as days_left
    from public.document_requests dr
    join public.certificates c
      on c.organization_id = dr.responder_org_id and c.certificate_type_id = dr.certificate_type_id
     and c.deleted_at is null and c.expiry_date is not null
    where dr.status in ('open','fulfilled')
      and ct_org_can_view_certificate(dr.requester_org_id, c.id)
      and not exists(
        select 1 from public.certificates newer
        where newer.organization_id = c.organization_id and newer.certificate_type_id = c.certificate_type_id
          and newer.deleted_at is null and newer.expiry_date > c.expiry_date
          and ct_org_can_view_certificate(dr.requester_org_id, newer.id))
  loop
    if x.days_left < 0 then
      perform ct_notify_org(x.requester_org_id, 'partner_certificate_expired', 'critical',
        'Έληξε πιστοποιητικό συνεργάτη', ct_org_name(x.organization_id) || ': ' || x.title || ' έχει λήξει.',
        'certificate', x.id, 'partner-expired:' || x.id::text || ':' || x.requester_org_id::text || ':' || x.expiry_date::text,
        'partner_certificate', jsonb_build_object('certificate_id', x.id, 'certificate_title', x.title,
          'expiry_date', x.expiry_date, 'partner_name', ct_org_name(x.organization_id)),
        'partner_certificate_expired');
    else
      select min(w) into v_days from unnest(array[30,7,0]) w where w >= x.days_left;
      if v_days is not null then
        perform ct_notify_org(x.requester_org_id, 'partner_certificate_expiring',
          case when v_days <= 7 then 'critical' else 'warning' end,
          'Πιστοποιητικό συνεργάτη προς λήξη',
          ct_org_name(x.organization_id) || ': ' || x.title || ' λήγει σε ' || x.days_left || ' ημέρες.',
          'certificate', x.id,
          'partner-expiring:' || x.id::text || ':' || x.requester_org_id::text || ':' || x.expiry_date::text || ':' || v_days,
          'partner_certificate', jsonb_build_object('certificate_id', x.id, 'certificate_title', x.title,
            'expiry_date', x.expiry_date, 'warning_days', v_days, 'partner_name', ct_org_name(x.organization_id)),
          'partner_certificate_expiring');
      end if;
    end if;
  end loop;

  -- Expire stale invitations.
  update public.invitations set status = 'expired' where status = 'pending' and expires_at <= now();

  return query select (select count(*) from public.notifications)::integer - n_before,
                      (select count(*) from public.email_outbox)::integer - e_before;
end;
$$;

create function public.ct_claim_email_batch(p_worker text, p_limit integer default 50)
returns setof public.email_outbox language plpgsql security definer set search_path = public as $$
begin
  return query
  with picked as (
    select id from public.email_outbox
    where status in ('pending','failed') and next_attempt_at <= now() and attempts < 5
      and (locked_at is null or locked_at < now() - interval '15 minutes')
    order by created_at
    for update skip locked
    limit greatest(1, least(p_limit, 100)))
  update public.email_outbox q
     set status = 'processing', locked_at = now(), locked_by = p_worker, attempts = q.attempts + 1
  from picked where q.id = picked.id
  returning q.*;
end;
$$;

create function public.ct_complete_email(p_id uuid, p_success boolean,
                                         p_provider_message_id text default null, p_error text default null)
returns void language sql security definer set search_path = public as $$
  update public.email_outbox set
    status = case when p_success then 'sent' else 'failed' end,
    provider_message_id = case when p_success then p_provider_message_id else provider_message_id end,
    sent_at = case when p_success then now() else sent_at end,
    last_error = case when p_success then null else left(coalesce(p_error, 'Unknown delivery error'), 2000) end,
    next_attempt_at = case when p_success then next_attempt_at
                           else now() + make_interval(mins => least(240, (power(2, greatest(attempts, 1)) * 5)::integer)) end,
    locked_at = null, locked_by = null
  where id = p_id
$$;

-- =============================================================================
-- Row level security
-- =============================================================================
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.platform_admins enable row level security;
alter table public.certificate_types enable row level security;
alter table public.certificates enable row level security;
alter table public.certificate_files enable row level security;
alter table public.connections enable row level security;
alter table public.invitations enable row level security;
alter table public.certificate_shares enable row level security;
alter table public.document_requests enable row level security;
alter table public.certificate_views enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.email_outbox enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_limit_events enable row level security;

-- Organizations: yourself, organizations you have a pending/active connection with, admins.
create policy organizations_select on public.organizations for select to authenticated using (
  ct_is_platform_admin() or ct_is_org_member(id)
  or exists(select 1 from ct_current_org_ids() me where ct_have_live_connection(me, organizations.id)));
create policy organizations_update on public.organizations for update to authenticated
  using (ct_has_org_role(id, array['owner','admin'])) with check (ct_has_org_role(id, array['owner','admin']));

-- Members: only your own organization (partners never see your staff).
create policy organization_members_select on public.organization_members for select to authenticated
  using (ct_is_platform_admin() or ct_is_org_member(organization_id));

create policy platform_admins_select on public.platform_admins for select to authenticated
  using (ct_is_platform_admin());

create policy certificate_types_select on public.certificate_types for select to authenticated using (true);

create policy certificates_select on public.certificates for select to authenticated using (
  ct_is_platform_admin()
  or (deleted_at is null and ct_is_org_member(organization_id))
  or exists(select 1 from ct_current_org_ids() me where ct_org_can_view_certificate(me, certificates.id)));
create policy certificates_insert on public.certificates for insert to authenticated
  with check (ct_has_org_role(organization_id, array['owner','admin','member']) and deleted_at is null);
create policy certificates_update on public.certificates for update to authenticated
  using (deleted_at is null and ct_has_org_role(organization_id, array['owner','admin','member']))
  with check (ct_has_org_role(organization_id, array['owner','admin','member']));

-- Owners see all versions; partners see only the current version of what they may view.
create policy certificate_files_select on public.certificate_files for select to authenticated using (
  ct_is_platform_admin() or ct_is_org_member(organization_id)
  or exists(select 1 from public.certificates c
            where c.id = certificate_files.certificate_id and c.current_file_id = certificate_files.id
              and exists(select 1 from ct_current_org_ids() me where ct_org_can_view_certificate(me, c.id))));

create policy connections_select on public.connections for select to authenticated using (
  ct_is_platform_admin() or ct_is_org_member(requester_org_id) or ct_is_org_member(addressee_org_id));

create policy invitations_select on public.invitations for select to authenticated using (
  ct_is_platform_admin() or ct_is_org_member(inviter_org_id));

-- Owner sees all shares of its certificates; a grantee sees only its own share
-- (never who else the certificate is shared with).
create policy certificate_shares_select on public.certificate_shares for select to authenticated using (
  ct_is_platform_admin()
  or ct_is_org_member(grantee_org_id)
  or exists(select 1 from public.certificates c where c.id = certificate_shares.certificate_id
            and ct_is_org_member(c.organization_id)));

create policy document_requests_select on public.document_requests for select to authenticated using (
  ct_is_platform_admin() or ct_is_org_member(requester_org_id) or ct_is_org_member(responder_org_id));

create policy certificate_views_select on public.certificate_views for select to authenticated using (
  ct_is_platform_admin() or ct_is_org_member(owner_org_id));

create policy notification_preferences_select on public.notification_preferences for select to authenticated
  using (user_id = auth.uid());
create policy notification_preferences_update on public.notification_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy audit_log_select on public.audit_log for select to authenticated using (
  ct_is_platform_admin() or (organization_id is not null and ct_has_org_role(organization_id, array['owner','admin'])));

-- email_outbox, rate_limit_events: no policies -> service role only.

-- =============================================================================
-- Grants: explicit, column-level where clients may write.
-- =============================================================================
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on public.organizations, public.organization_members, public.platform_admins,
  public.certificate_types, public.certificates, public.certificate_files, public.connections,
  public.invitations, public.certificate_shares, public.document_requests, public.certificate_views,
  public.notification_preferences, public.notifications, public.audit_log
  to authenticated;

grant update (legal_name, display_name, contact_email, phone, website, address_line1, address_line2, city, postal_code)
  on public.organizations to authenticated;
grant insert (organization_id, certificate_type_id, custom_type_label, title, certificate_number, issuer,
              issue_date, expiry_date, notes, sharing)
  on public.certificates to authenticated;
grant update (certificate_type_id, custom_type_label, title, certificate_number, issuer,
              issue_date, expiry_date, notes)
  on public.certificates to authenticated;
grant update (in_app_enabled, email_enabled, expiry_in_app_enabled, expiry_email_enabled, expiry_warning_days,
              relationship_notifications, partner_certificate_notifications)
  on public.notification_preferences to authenticated;

-- Functions clients may call. Everything else stays internal.
grant execute on function
  public.ct_is_platform_admin(uuid),
  public.ct_find_partner_candidate(text),
  public.ct_request_connection(uuid, text),
  public.ct_respond_connection(uuid, boolean),
  public.ct_end_connection(uuid, text),
  public.ct_cancel_invitation(uuid),
  public.ct_list_connections(uuid),
  public.ct_set_certificate_sharing(uuid, text, jsonb),
  public.ct_register_certificate_file(uuid, text, text, text, bigint),
  public.ct_soft_delete_certificate(uuid),
  public.ct_abort_certificate_draft(uuid),
  public.ct_open_certificate(uuid),
  public.ct_request_document(uuid, uuid, text, date),
  public.ct_cancel_document_request(uuid),
  public.ct_decline_document_request(uuid, text),
  public.ct_fulfill_document_request(uuid, uuid),
  public.ct_set_notification_read(uuid, boolean),
  public.ct_mark_notifications_read(uuid[]),
  public.ct_request_organization_closure(uuid, text),
  public.ct_cancel_organization_closure(uuid),
  public.ct_platform_set_organization_state(uuid, text, text),
  public.ct_admin_network()
to authenticated;

-- RLS policies call these helpers as the querying role.
grant execute on function
  public.ct_is_org_member(uuid, uuid),
  public.ct_has_org_role(uuid, text[], uuid),
  public.ct_current_org_ids(),
  public.ct_have_live_connection(uuid, uuid),
  public.ct_org_can_view_certificate(uuid, uuid),
  public.ct_can_view_certificate(uuid),
  public.ct_normalize_vat(text),
  public.ct_try_uuid(text),
  public.ct_recently_opened(uuid)
to authenticated;

grant execute on function
  public.ct_generate_expiry_notifications(date),
  public.ct_claim_email_batch(text, integer),
  public.ct_complete_email(uuid, boolean, text, text),
  public.ct_check_rate_limit(text, int, int),
  public.ct_finalize_erasure(uuid)
to service_role;

-- New objects created later must opt in to client access explicitly.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- =============================================================================
-- Storage: private PDF bucket, path <organization_id>/<certificate_id>/<file>.pdf
-- =============================================================================
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('organizationcertificates', 'organizationcertificates', false, 26214400, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 26214400, allowed_mime_types = array['application/pdf'];

create policy ct_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'organizationcertificates' and (
    ct_is_platform_admin()
    or ct_is_org_member(ct_try_uuid(split_part(name, '/', 1)))
    or exists(
      select 1 from public.certificate_files f
      join public.certificates c on c.id = f.certificate_id and c.current_file_id = f.id
      where f.storage_path = storage.objects.name
        and exists(select 1 from ct_current_org_ids() me where ct_org_can_view_certificate(me, c.id))
        and ct_recently_opened(f.id))));

create policy ct_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'organizationcertificates'
  and lower(storage.extension(name)) = 'pdf'
  and ct_has_org_role(ct_try_uuid(split_part(name, '/', 1)), array['owner','admin','member'])
  and exists(select 1 from public.certificates c
             where c.id::text = split_part(storage.objects.name, '/', 2)
               and c.organization_id::text = split_part(storage.objects.name, '/', 1)
               and c.deleted_at is null));
-- No client UPDATE/DELETE: stored PDFs are immutable; a replacement is a new version.
