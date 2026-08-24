-- CertiTrack notification scheduler prerequisites.
-- Run only AFTER 01_certitrack_production_schema.sql validates successfully.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select extname,extversion
from pg_extension
where extname in ('pg_cron','pg_net')
order by extname;

select to_regnamespace('vault') as vault_schema;
