-- CertiTrack Phase 33 — READ ONLY preflight.
-- This file makes no schema or data changes.

-- 1) Existing public tables
select table_name
from information_schema.tables
where table_schema='public'
order by table_name;

-- 2) Columns in legacy/current CertiTrack tables
select table_name,column_name,data_type,is_nullable
from information_schema.columns
where table_schema='public'
  and table_name in (
    'companies','suppliers','company_certificates','supplier_certificates','company_suppliers',
    'organizations','organization_members','certificates','organization_relationships'
  )
order by table_name,ordinal_position;

-- 3) Row counts (only for tables that exist; returned as JSON)
select jsonb_object_agg(t.table_name,t.row_count order by t.table_name) as certitrack_row_counts
from (
  select c.relname as table_name, c.reltuples::bigint as row_count
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r'
    and c.relname in ('companies','suppliers','company_certificates','supplier_certificates','company_suppliers','organizations','certificates','organization_relationships')
) t;

-- 4) Current RLS state
select tablename,rowsecurity
from pg_tables
where schemaname='public'
order by tablename;

-- 5) Current policies
select schemaname,tablename,policyname,cmd,roles
from pg_policies
where schemaname in ('public','storage')
order by schemaname,tablename,policyname;

-- 6) Storage buckets
select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets
order by id;

-- 7) Existing CertiTrack functions
select routine_name,routine_type
from information_schema.routines
where routine_schema='public'
  and (routine_name like 'ct_%' or routine_name like '%organization%')
order by routine_name;
