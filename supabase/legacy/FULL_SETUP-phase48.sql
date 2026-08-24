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
-- CertiTrack auth + helper functions
begin;
create or replace function public.ct_normalize_vat(value text)
returns text language sql immutable set search_path=public as $$
  select nullif(regexp_replace(upper(trim(coalesce(value,''))),'[^A-Z0-9]','','g'),'');
$$;

create or replace function public.ct_touch_updated_at()
returns trigger language plpgsql set search_path=public as $$ begin new.updated_at:=now(); return new; end; $$;

create or replace function public.ct_current_org_ids()
returns setof uuid language sql stable security definer set search_path=public as $$
 select organization_id from public.organization_members where user_id=auth.uid() and status='active';
$$;

create or replace function public.ct_is_org_member(p_org uuid,p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_user and status='active');
$$;

create or replace function public.ct_has_org_role(p_org uuid,p_roles text[],p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_user and status='active' and role=any(p_roles));
$$;

create or replace function public.ct_is_platform_admin(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.platform_admins where user_id=p_user and active=true);
$$;

create or replace function public.ct_handle_new_auth_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_name text; v_vat text; v_country text;
begin
 if coalesce(new.raw_user_meta_data->>'type','')<>'organization' then return new; end if;
 v_name:=nullif(trim(coalesce(new.raw_user_meta_data->>'organization_name',new.raw_user_meta_data->>'name')),'');
 v_vat:=public.ct_normalize_vat(coalesce(new.raw_user_meta_data->>'vat_number',new.raw_user_meta_data->>'afm'));
 v_country:=upper(coalesce(nullif(trim(new.raw_user_meta_data->>'country_code'),''),'GR'));
 if v_name is null then raise exception 'Organization name is required'; end if;
 if v_vat is null then raise exception 'VAT number is required'; end if;
 insert into public.organizations(legal_name,display_name,vat_number,country_code,contact_email,status,created_by)
 values(v_name,v_name,v_vat,v_country,new.email,'active',new.id) returning id into v_org;
 insert into public.organization_members(organization_id,user_id,role,status) values(v_org,new.id,'owner','active');
 insert into public.notification_preferences(organization_id,organization_name,user_id) values(v_org,v_name,new.id);
 return new;
exception when unique_violation then raise exception 'An organization with this VAT number already exists';
end; $$;

drop trigger if exists ct_on_auth_user_created on auth.users;
create trigger ct_on_auth_user_created after insert on auth.users for each row execute function public.ct_handle_new_auth_user();

-- updated_at triggers
DO $$ declare t text; begin
 foreach t in array array['organizations','organization_members','organization_relationships','certificate_types','certificates','relationship_requirements','notification_preferences','email_outbox'] loop
   execute format('drop trigger if exists ct_touch_%I on public.%I',t,t);
   execute format('create trigger ct_touch_%I before update on public.%I for each row execute function public.ct_touch_updated_at()',t,t);
 end loop;
end $$;
commit;
-- CertiTrack RLS policies
begin;
DO $$ declare t text; begin
 foreach t in array array['organizations','organization_members','organization_relationships','certificate_types','certificates','certificate_files','relationship_requirements','notification_preferences','notifications','audit_log','email_outbox','platform_admins'] loop
   execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;

-- Drop current policy names for rerun safety
DO $$ declare r record; begin
 for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' loop
   execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename);
 end loop;
end $$;

create policy organizations_select on public.organizations for select to authenticated using (
 public.ct_is_org_member(id) or exists(select 1 from public.organization_relationships r where r.status='active' and ((r.requester_organization_id=organizations.id and r.partner_organization_id in(select public.ct_current_org_ids())) or (r.partner_organization_id=organizations.id and r.requester_organization_id in(select public.ct_current_org_ids()))))
);
create policy organizations_update on public.organizations for update to authenticated using(public.ct_has_org_role(id,array['owner','admin'])) with check(public.ct_has_org_role(id,array['owner','admin']));

create policy organization_members_select on public.organization_members for select to authenticated using(public.ct_is_org_member(organization_id));
create policy organization_members_insert on public.organization_members for insert to authenticated with check(public.ct_has_org_role(organization_id,array['owner','admin']));
create policy organization_members_update on public.organization_members for update to authenticated using(public.ct_has_org_role(organization_id,array['owner','admin'])) with check(public.ct_has_org_role(organization_id,array['owner','admin']));
create policy organization_members_delete on public.organization_members for delete to authenticated using(public.ct_has_org_role(organization_id,array['owner','admin']));

create policy relationships_select on public.organization_relationships for select to authenticated using(requester_organization_id in(select public.ct_current_org_ids()) or partner_organization_id in(select public.ct_current_org_ids()));
create policy relationships_insert on public.organization_relationships for insert to authenticated with check(requester_organization_id in(select public.ct_current_org_ids()) and public.ct_has_org_role(requester_organization_id,array['owner','admin']));
create policy relationships_update on public.organization_relationships for update to authenticated using((requester_organization_id in(select public.ct_current_org_ids()) and public.ct_has_org_role(requester_organization_id,array['owner','admin'])) or (partner_organization_id in(select public.ct_current_org_ids()) and public.ct_has_org_role(partner_organization_id,array['owner','admin']))) with check(requester_organization_id in(select public.ct_current_org_ids()) or partner_organization_id in(select public.ct_current_org_ids()));

create policy certificate_types_select on public.certificate_types for select to authenticated using(active=true);
create policy certificates_select on public.certificates for select to authenticated using(
 organization_id in(select public.ct_current_org_ids()) or (visibility='partners' and deleted_at is null and exists(select 1 from public.organization_relationships r where r.status='active' and ((r.requester_organization_id=certificates.organization_id and r.partner_organization_id in(select public.ct_current_org_ids())) or (r.partner_organization_id=certificates.organization_id and r.requester_organization_id in(select public.ct_current_org_ids())))))
);
create policy certificates_insert on public.certificates for insert to authenticated with check(organization_id in(select public.ct_current_org_ids()) and public.ct_has_org_role(organization_id,array['owner','admin','member']));
create policy certificates_update on public.certificates for update to authenticated using(organization_id in(select public.ct_current_org_ids())) with check(organization_id in(select public.ct_current_org_ids()));
create policy certificates_delete on public.certificates for delete to authenticated using(public.ct_has_org_role(organization_id,array['owner','admin']));

create policy certificate_files_select on public.certificate_files for select to authenticated using(exists(select 1 from public.certificates c where c.id=certificate_files.certificate_id));
create policy certificate_files_insert on public.certificate_files for insert to authenticated with check(organization_id in(select public.ct_current_org_ids()));
create policy certificate_files_delete on public.certificate_files for delete to authenticated using(public.ct_has_org_role(organization_id,array['owner','admin']));

create policy relationship_requirements_select on public.relationship_requirements for select to authenticated using(requester_organization_id in(select public.ct_current_org_ids()) or partner_organization_id in(select public.ct_current_org_ids()));
create policy relationship_requirements_insert on public.relationship_requirements for insert to authenticated with check(requester_organization_id in(select public.ct_current_org_ids()) and public.ct_has_org_role(requester_organization_id,array['owner','admin']));
create policy relationship_requirements_update on public.relationship_requirements for update to authenticated using(public.ct_has_org_role(requester_organization_id,array['owner','admin'])) with check(public.ct_has_org_role(requester_organization_id,array['owner','admin']));
create policy relationship_requirements_delete on public.relationship_requirements for delete to authenticated using(public.ct_has_org_role(requester_organization_id,array['owner','admin']));

create policy notification_preferences_select on public.notification_preferences for select to authenticated using(user_id=auth.uid());
create policy notification_preferences_insert on public.notification_preferences for insert to authenticated with check(user_id=auth.uid() and organization_id in(select public.ct_current_org_ids()));
create policy notification_preferences_update on public.notification_preferences for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy notifications_select on public.notifications for select to authenticated using(user_id=auth.uid());
create policy notifications_update on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy audit_log_select on public.audit_log for select to authenticated using(organization_id is not null and public.ct_has_org_role(organization_id,array['owner','admin']));
commit;
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
-- Snapshots, audit and partner business functions
begin;
create or replace function public.ct_fill_certificate_snapshots() returns trigger language plpgsql security definer set search_path=public as $$
declare v_org_name text; v_code text; v_name text;
begin
 select coalesce(display_name,legal_name) into v_org_name from public.organizations where id=new.organization_id;
 if v_org_name is null then raise exception 'Invalid organization'; end if;
 if new.certificate_type_id is not null then
   select code,name into v_code,v_name from public.certificate_types where id=new.certificate_type_id and active=true;
   if v_code is null then raise exception 'Invalid or inactive certificate type'; end if;
   new.certificate_type_code:=v_code; new.certificate_type_name:=v_name;
 elsif nullif(trim(new.certificate_type_code),'') is null or nullif(trim(new.certificate_type_name),'') is null then
   raise exception 'Certificate type code and name are required';
 end if;
 new.organization_name:=v_org_name; return new;
end $$;
drop trigger if exists ct_fill_certificate_snapshots on public.certificates;
create trigger ct_fill_certificate_snapshots before insert or update of organization_id,certificate_type_id on public.certificates for each row execute function public.ct_fill_certificate_snapshots();

create or replace function public.ct_fill_certificate_file_snapshots() returns trigger language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_org_name text; v_type text;
begin
 select organization_id,organization_name,certificate_type_name into v_org,v_org_name,v_type from public.certificates where id=new.certificate_id and deleted_at is null;
 if v_org is null then raise exception 'Invalid certificate'; end if;
 new.organization_id:=v_org; new.organization_name:=v_org_name; new.certificate_type_name:=v_type; return new;
end $$;
drop trigger if exists ct_fill_certificate_file_snapshots on public.certificate_files;
create trigger ct_fill_certificate_file_snapshots before insert or update of certificate_id on public.certificate_files for each row execute function public.ct_fill_certificate_file_snapshots();

create or replace function public.ct_fill_requirement_snapshots() returns trigger language plpgsql security definer set search_path=public as $$
declare a uuid; b uuid; an text; bn text; tc text; tn text;
begin
 select requester_organization_id,partner_organization_id into a,b from public.organization_relationships where id=new.relationship_id;
 if a is null or b is null then raise exception 'Invalid organization relationship'; end if;
 select coalesce(display_name,legal_name) into an from public.organizations where id=a;
 select coalesce(display_name,legal_name) into bn from public.organizations where id=b;
 select code,name into tc,tn from public.certificate_types where id=new.certificate_type_id and active=true;
 if tc is null then raise exception 'Invalid or inactive certificate type'; end if;
 new.requester_organization_id:=a; new.partner_organization_id:=b; new.requester_organization_name:=an; new.partner_organization_name:=bn; new.certificate_type_code:=tc; new.certificate_type_name:=tn; return new;
end $$;
drop trigger if exists ct_fill_requirement_snapshots on public.relationship_requirements;
create trigger ct_fill_requirement_snapshots before insert or update of relationship_id,certificate_type_id on public.relationship_requirements for each row execute function public.ct_fill_requirement_snapshots();

create or replace function public.ct_write_audit(p_org uuid,p_org_name text,p_action text,p_entity_type text,p_entity_id text,p_entity_name text,p_old jsonb,p_new jsonb,p_metadata jsonb default '{}'::jsonb,p_actor uuid default auth.uid()) returns void language plpgsql security definer set search_path=public as $$
declare e text; begin select email into e from auth.users where id=p_actor; insert into public.audit_log(organization_id,organization_name,actor_user_id,actor_email,action,entity_type,entity_id,entity_name,old_values,new_values,metadata) values(p_org,p_org_name,p_actor,e,p_action,p_entity_type,p_entity_id,p_entity_name,p_old,p_new,coalesce(p_metadata,'{}'::jsonb)); end $$;

create or replace function public.ct_audit_certificate() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then perform public.ct_write_audit(new.organization_id,new.organization_name,'created','certificate',new.id::text,new.certificate_type_name,null,to_jsonb(new)); return new;
 elsif tg_op='UPDATE' then perform public.ct_write_audit(new.organization_id,new.organization_name,'updated','certificate',new.id::text,new.certificate_type_name,to_jsonb(old),to_jsonb(new)); return new;
 else perform public.ct_write_audit(old.organization_id,old.organization_name,'deleted','certificate',old.id::text,old.certificate_type_name,to_jsonb(old),null); return old; end if;
end $$;
drop trigger if exists ct_audit_certificate on public.certificates;
create trigger ct_audit_certificate after insert or update or delete on public.certificates for each row execute function public.ct_audit_certificate();

create or replace function public.ct_find_partner_candidate(p_lookup text)
returns table(id uuid,name text,afm text,email text) language sql stable security definer set search_path=public as $$
 select o.id,coalesce(o.display_name,o.legal_name),o.vat_number,o.contact_email from public.organizations o where o.status='active' and o.id not in(select public.ct_current_org_ids()) and (upper(o.vat_number)=upper(public.ct_normalize_vat(p_lookup)) or lower(coalesce(o.contact_email,''))=lower(trim(p_lookup))) limit 1;
$$;

create or replace function public.ct_request_relationship(p_requester_org uuid,p_lookup text) returns uuid language plpgsql security definer set search_path=public as $$
declare target uuid; an text; bn text; rid uuid;
begin
 if not public.ct_has_org_role(p_requester_org,array['owner','admin']) then raise exception 'Not allowed'; end if;
 select id into target from public.organizations where status='active' and id<>p_requester_org and (upper(vat_number)=upper(public.ct_normalize_vat(p_lookup)) or lower(coalesce(contact_email,''))=lower(trim(p_lookup))) limit 1;
 if target is null then raise exception 'Ο οργανισμός δεν είναι ακόμη εγγεγραμμένος στο CertiTrack.'; end if;
 select coalesce(display_name,legal_name) into an from public.organizations where id=p_requester_org;
 select coalesce(display_name,legal_name) into bn from public.organizations where id=target;
 if exists(select 1 from public.organization_relationships where (requester_organization_id=p_requester_org and partner_organization_id=target) or (requester_organization_id=target and partner_organization_id=p_requester_org)) then raise exception 'Υπάρχει ήδη σχέση ή εκκρεμές αίτημα με αυτόν τον οργανισμό.'; end if;
 insert into public.organization_relationships(requester_organization_id,partner_organization_id,requester_name,partner_name,status,requested_by) values(p_requester_org,target,an,bn,'pending',auth.uid()) returning id into rid; return rid;
end $$;

create or replace function public.ct_respond_relationship(p_relationship uuid,p_accept boolean) returns void language plpgsql security definer set search_path=public as $$
declare r public.organization_relationships%rowtype; begin select * into r from public.organization_relationships where id=p_relationship; if r.id is null then raise exception 'Relationship not found'; end if; if not public.ct_has_org_role(r.partner_organization_id,array['owner','admin']) then raise exception 'Not allowed'; end if; update public.organization_relationships set status=case when p_accept then 'active' else 'rejected' end,accepted_by=case when p_accept then auth.uid() else null end where id=p_relationship and status='pending'; end $$;

create or replace function public.ct_end_relationship(p_relationship uuid) returns void language plpgsql security definer set search_path=public as $$
declare r public.organization_relationships%rowtype; begin select * into r from public.organization_relationships where id=p_relationship; if r.id is null then raise exception 'Relationship not found'; end if; if not(public.ct_has_org_role(r.requester_organization_id,array['owner','admin']) or public.ct_has_org_role(r.partner_organization_id,array['owner','admin'])) then raise exception 'Not allowed'; end if; update public.organization_relationships set status='ended' where id=p_relationship; end $$;

revoke all on function public.ct_find_partner_candidate(text) from public;
revoke all on function public.ct_request_relationship(uuid,text) from public;
revoke all on function public.ct_respond_relationship(uuid,boolean) from public;
revoke all on function public.ct_end_relationship(uuid) from public;
grant execute on function public.ct_find_partner_candidate(text) to authenticated;
grant execute on function public.ct_request_relationship(uuid,text) to authenticated;
grant execute on function public.ct_respond_relationship(uuid,boolean) to authenticated;
grant execute on function public.ct_end_relationship(uuid) to authenticated;
commit;
-- API grants + PostgREST reload
begin;
grant select,insert,delete on public.certificate_files to authenticated;
grant select,insert,update,delete on public.certificates to authenticated;
grant select on public.certificate_types to authenticated;
grant select,update on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select,insert,update on public.organization_relationships to authenticated;
grant select,insert,update,delete on public.relationship_requirements to authenticated;
grant select,insert,update on public.notification_preferences to authenticated;
grant select,update on public.notifications to authenticated;
grant select on public.audit_log to authenticated;
notify pgrst, 'reload schema';
commit;
