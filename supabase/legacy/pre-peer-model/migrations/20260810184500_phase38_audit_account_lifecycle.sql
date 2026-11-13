-- CertiTrack Phase 38 — Audit, membership and organization account lifecycle
-- Apply after Phase37.

-- -----------------------------------------------------------------------------
-- Organization lifecycle metadata
-- -----------------------------------------------------------------------------
alter table public.organizations add column if not exists closure_requested_at timestamptz;
alter table public.organizations add column if not exists closure_requested_by uuid references auth.users(id) on delete set null;
alter table public.organizations add column if not exists closure_reason text;
alter table public.organizations add column if not exists suspended_at timestamptz;
alter table public.organizations add column if not exists suspended_by uuid references auth.users(id) on delete set null;
alter table public.organizations add column if not exists suspension_reason text;

-- -----------------------------------------------------------------------------
-- Append-only audit
-- -----------------------------------------------------------------------------
revoke insert,update,delete on public.audit_log from anon,authenticated;

create or replace function public.ct_write_audit(
  p_org uuid,p_action text,p_entity_type text,p_entity_id text,
  p_old jsonb default null,p_new jsonb default null,p_metadata jsonb default '{}'::jsonb,
  p_actor uuid default auth.uid()
) returns void
language plpgsql security definer set search_path=public
as $$
begin
  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,old_data,new_data,metadata)
  values(p_org,p_actor,p_action,p_entity_type,p_entity_id,p_old,p_new,coalesce(p_metadata,'{}'::jsonb));
end;
$$;
revoke all on function public.ct_write_audit(uuid,text,text,text,jsonb,jsonb,jsonb,uuid) from public;

create or replace function public.ct_audit_row_change()
returns trigger
language plpgsql security definer set search_path=public
as $$
declare org uuid; eid text; oldj jsonb; newj jsonb;
begin
  if tg_op='INSERT' then oldj:=null; newj:=to_jsonb(new); eid:=new.id::text;
  elsif tg_op='DELETE' then oldj:=to_jsonb(old); newj:=null; eid:=old.id::text;
  else oldj:=to_jsonb(old); newj:=to_jsonb(new); eid:=new.id::text;
  end if;

  if tg_table_name='certificates' then
    org:=coalesce(nullif(newj->>'organization_id','')::uuid,nullif(oldj->>'organization_id','')::uuid);
  elsif tg_table_name='certificate_files' then
    org:=coalesce(nullif(newj->>'organization_id','')::uuid,nullif(oldj->>'organization_id','')::uuid);
  elsif tg_table_name='organization_relationships' then
    org:=coalesce(nullif(newj->>'requester_id','')::uuid,nullif(oldj->>'requester_id','')::uuid);
  elsif tg_table_name='organization_members' then
    org:=coalesce(nullif(newj->>'organization_id','')::uuid,nullif(oldj->>'organization_id','')::uuid);
  elsif tg_table_name='organizations' then org:=eid::uuid;
  end if;

  perform public.ct_write_audit(org,lower(tg_op),tg_table_name,eid,oldj,newj,
    jsonb_build_object('trigger',true,'table',tg_table_name),auth.uid());
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists ct_audit_organization_members on public.organization_members;
create trigger ct_audit_organization_members
after insert or update or delete on public.organization_members
for each row execute procedure public.ct_audit_row_change();

-- -----------------------------------------------------------------------------
-- Platform-admin audit visibility; normal members remain tenant-scoped.
-- -----------------------------------------------------------------------------
drop policy if exists ct_audit_select on public.audit_log;
create policy ct_audit_select on public.audit_log for select to authenticated
using (ct_is_platform_admin() or ct_is_org_member(organization_id));

-- -----------------------------------------------------------------------------
-- Membership lifecycle
-- -----------------------------------------------------------------------------
create or replace function public.ct_change_member_role(p_org uuid,p_member uuid,p_role text)
returns public.organization_members
language plpgsql security definer set search_path=public
as $$
declare m public.organization_members; owner_count integer;
begin
  if p_role not in ('owner','admin','member','viewer') then raise exception 'Invalid role'; end if;
  if not ct_has_org_role(p_org,array['owner','admin']) then raise exception 'Insufficient permission'; end if;
  select * into m from public.organization_members where id=p_member and organization_id=p_org for update;
  if m.id is null then raise exception 'Member not found'; end if;
  if m.role='owner' and p_role<>'owner' then
    select count(*) into owner_count from public.organization_members
    where organization_id=p_org and role='owner' and status='active';
    if owner_count<=1 then raise exception 'The organization must retain at least one active owner'; end if;
  end if;
  update public.organization_members set role=p_role,updated_at=now() where id=m.id returning * into m;
  return m;
end;
$$;

create or replace function public.ct_remove_member(p_org uuid,p_member uuid)
returns void
language plpgsql security definer set search_path=public
as $$
declare m public.organization_members; owner_count integer;
begin
  if not ct_has_org_role(p_org,array['owner','admin']) then raise exception 'Insufficient permission'; end if;
  select * into m from public.organization_members where id=p_member and organization_id=p_org for update;
  if m.id is null then return; end if;
  if m.user_id=auth.uid() and m.role='owner' then raise exception 'Transfer ownership before removing yourself'; end if;
  if m.role='owner' and m.status='active' then
    select count(*) into owner_count from public.organization_members where organization_id=p_org and role='owner' and status='active';
    if owner_count<=1 then raise exception 'The organization must retain at least one active owner'; end if;
  end if;
  update public.organization_members set status='removed',removed_at=now(),updated_at=now() where id=m.id;
end;
$$;

grant execute on function public.ct_change_member_role(uuid,uuid,text) to authenticated;
grant execute on function public.ct_remove_member(uuid,uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Organization closure: request -> platform review -> close/cancel.
-- This never hard-deletes certificates, files, relationships or audit records.
-- -----------------------------------------------------------------------------
create or replace function public.ct_request_organization_closure(p_org uuid,p_reason text default null)
returns public.organizations
language plpgsql security definer set search_path=public
as $$
declare o public.organizations;
begin
  if not ct_has_org_role(p_org,array['owner']) then raise exception 'Only an owner may request organization closure'; end if;
  select * into o from public.organizations where id=p_org for update;
  if o.id is null then raise exception 'Organization not found'; end if;
  if o.status in ('closed','closure_requested') then raise exception 'Organization is already closed or awaiting closure'; end if;
  update public.organizations set status='closure_requested',closure_requested_at=now(),
    closure_requested_by=auth.uid(),closure_reason=nullif(trim(p_reason),''),
    updated_at=now()
  where id=p_org returning * into o;
  perform public.ct_write_audit(p_org,'closure_requested','organization',p_org::text,null,to_jsonb(o),
    jsonb_build_object('reason',p_reason),auth.uid());
  return o;
end;
$$;

create or replace function public.ct_cancel_organization_closure(p_org uuid)
returns public.organizations
language plpgsql security definer set search_path=public
as $$
declare o public.organizations;
begin
  if not ct_has_org_role(p_org,array['owner']) then raise exception 'Only an owner may cancel closure'; end if;
  update public.organizations set status='active',closure_requested_at=null,closure_requested_by=null,
    closure_reason=null,updated_at=now()
  where id=p_org and status='closure_requested' returning * into o;
  if o.id is null then raise exception 'No closure request is pending'; end if;
  perform public.ct_write_audit(p_org,'closure_cancelled','organization',p_org::text,null,to_jsonb(o),'{}',auth.uid());
  return o;
end;
$$;

create or replace function public.ct_platform_set_organization_state(p_org uuid,p_state text,p_reason text default null)
returns public.organizations
language plpgsql security definer set search_path=public
as $$
declare o public.organizations;
begin
  if not ct_is_platform_admin() then raise exception 'Platform administrator required'; end if;
  if p_state not in ('active','suspended','closed') then raise exception 'Invalid organization state'; end if;
  select * into o from public.organizations where id=p_org for update;
  if o.id is null then raise exception 'Organization not found'; end if;

  update public.organizations set
    status=p_state,
    blocked=(p_state='suspended'),
    suspended_at=case when p_state='suspended' then now() else null end,
    suspended_by=case when p_state='suspended' then auth.uid() else null end,
    suspension_reason=case when p_state='suspended' then nullif(trim(p_reason),'') else null end,
    closed_at=case when p_state='closed' then now() else closed_at end,
    updated_at=now()
  where id=p_org returning * into o;

  if p_state='closed' then
    update public.organization_members set status='suspended',updated_at=now()
    where organization_id=p_org and status='active';
    update public.organization_relationships set status='ended',ended_at=now(),ended_by=auth.uid(),
      end_reason='organization_closed',updated_at=now()
    where status in ('pending','active')
      and (requester_id=p_org or partner_id=p_org);
  elsif p_state='active' then
    update public.organization_members set status='active',updated_at=now()
    where organization_id=p_org and status='suspended';
  end if;

  perform public.ct_write_audit(p_org,'organization_'||p_state,'organization',p_org::text,null,to_jsonb(o),
    jsonb_build_object('reason',p_reason),auth.uid());
  return o;
end;
$$;

grant execute on function public.ct_request_organization_closure(uuid,text) to authenticated;
grant execute on function public.ct_cancel_organization_closure(uuid) to authenticated;
grant execute on function public.ct_platform_set_organization_state(uuid,text,text) to authenticated;

-- -----------------------------------------------------------------------------
-- Block normal organization access when tenant is suspended/closed.
-- -----------------------------------------------------------------------------
create or replace function public.ct_is_org_operational(p_org uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(select 1 from public.organizations o
    where o.id=p_org and o.deleted_at is null and o.status in ('active','closure_requested') and o.blocked=false)
$$;
revoke all on function public.ct_is_org_operational(uuid) from public;
grant execute on function public.ct_is_org_operational(uuid) to authenticated;

-- Model version
create or replace function public.organization_model_version()
returns text language sql stable security definer set search_path=public as $$ select '38'::text $$;
revoke all on function public.organization_model_version() from public;
grant execute on function public.organization_model_version() to anon,authenticated;
