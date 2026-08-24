-- Read-only check after a failed transactional deployment.
select
  to_regclass('public.organizations') as organizations_table,
  to_regclass('public.organization_members') as organization_members_table,
  to_regclass('public.certificates') as certificates_table,
  to_regclass('public.organization_relationships') as relationships_table,
  to_regclass('public.email_outbox') as email_outbox_table;
