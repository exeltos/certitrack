-- Phase 33 read-only schema checks. Safe after migration.
select public.organization_model_version() as expected_33;

select table_name
from information_schema.tables
where table_schema='public' and table_name in (
 'organizations','organization_members','certificate_types','certificates',
 'organization_relationships','relationship_invitations','notification_preferences',
 'notifications','audit_log','platform_admins'
)
order by table_name;

select tablename, rowsecurity
from pg_tables
where schemaname='public' and tablename in (
 'organizations','organization_members','certificate_types','certificates',
 'organization_relationships','relationship_invitations','notification_preferences',
 'notifications','audit_log','platform_admins'
)
order by tablename;

select tablename, policyname, cmd
from pg_policies
where schemaname='public' and tablename in (
 'organizations','organization_members','certificate_types','certificates',
 'organization_relationships','relationship_invitations','notification_preferences',
 'notifications','audit_log','platform_admins'
)
order by tablename,policyname;

select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets where id='organizationcertificates';
