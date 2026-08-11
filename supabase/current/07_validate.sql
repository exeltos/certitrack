-- Read-only validation
select tablename,rowsecurity from pg_tables where schemaname='public' order by tablename;
select code,name,active from public.certificate_types order by code;
select id,name,public,file_size_limit,allowed_mime_types from storage.buckets where id='organizationcertificates';
select tablename,policyname,cmd from pg_policies where schemaname='public' order by tablename,policyname;
select policyname,cmd from pg_policies where schemaname='storage' and tablename='objects' order by policyname;
select trigger_name,event_manipulation,event_object_schema,event_object_table from information_schema.triggers where trigger_name like 'ct_%' order by event_object_schema,event_object_table,trigger_name;
