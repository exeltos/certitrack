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
