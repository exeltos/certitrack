-- CertiTrack Production Validation — read-only checks.

select public.organization_model_version() as model_version;

select table_name
from information_schema.tables
where table_schema='public'
  and table_name in (
    'organizations','organization_members','certificate_types','certificates','certificate_files',
    'organization_relationships','relationship_invitations','notification_preferences','notifications',
    'email_outbox','audit_log','platform_admins','compliance_profiles','compliance_profile_items',
    'relationship_requirements'
  )
order by table_name;

select schemaname,tablename,rowsecurity
from pg_tables
where schemaname='public'
  and tablename in (
    'organizations','organization_members','certificate_types','certificates','certificate_files',
    'organization_relationships','relationship_invitations','notification_preferences','notifications',
    'email_outbox','audit_log','platform_admins','compliance_profiles','compliance_profile_items',
    'relationship_requirements'
  )
order by tablename;

select schemaname,tablename,policyname,cmd,roles
from pg_policies
where schemaname in ('public','storage')
  and (
    tablename in (
      'organizations','organization_members','certificate_types','certificates','certificate_files',
      'organization_relationships','relationship_invitations','notification_preferences','notifications',
      'audit_log','platform_admins','compliance_profiles','compliance_profile_items','relationship_requirements'
    )
    or (schemaname='storage' and tablename='objects' and policyname like 'ct_%')
  )
order by schemaname,tablename,policyname;

select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets
where id in ('organizationcertificates','companycertificates','suppliercertificates')
order by id;

select code,name,name_el,name_en,requires_expiry,active,sort_order
from public.certificate_types
order by sort_order,code;

select
  (select count(*) from auth.users) auth_users,
  (select count(*) from public.organizations) organizations,
  (select count(*) from public.organization_members) members,
  (select count(*) from public.certificates) certificates,
  (select count(*) from public.organization_relationships) relationships,
  (select count(*) from public.audit_log) audit_rows;
