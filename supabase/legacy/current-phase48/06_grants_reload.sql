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
