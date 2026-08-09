-- CertiTrack live database / RLS inventory (READ-ONLY)
-- Run in Supabase SQL Editor. This script does not change data or policies.

-- 1. Public tables and RLS state
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;

-- 2. Columns
select table_name, ordinal_position, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public'
order by table_name, ordinal_position;

-- 3. Foreign keys
select tc.table_name, kcu.column_name, ccu.table_name as foreign_table_name, ccu.column_name as foreign_column_name, tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and ccu.table_schema=tc.table_schema
where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'
order by tc.table_name, tc.constraint_name;

-- 4. Indexes
select schemaname, tablename, indexname, indexdef
from pg_indexes where schemaname='public'
order by tablename,indexname;

-- 5. ALL RLS policies
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public','storage')
order by schemaname, tablename, policyname;

-- 6. Storage buckets
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets order by id;

-- 7. Storage objects counts only (no object content)
select bucket_id, count(*) as object_count
from storage.objects group by bucket_id order by bucket_id;

-- 8. Functions in public schema
select p.proname as function_name, pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as result_type, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
order by p.proname;

-- 9. Triggers
select event_object_table as table_name, trigger_name, event_manipulation, action_timing, action_statement
from information_schema.triggers
where trigger_schema='public'
order by event_object_table, trigger_name;

-- 10. Grants on public tables
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema='public'
order by table_name, grantee, privilege_type;
