-- CertiTrack Phase 36 — Relationships, invitations, notifications and partner access

alter table public.relationship_invitations add column if not exists relationship_id uuid references public.organization_relationships(id) on delete set null;
alter table public.relationship_invitations add column if not exists cancelled_at timestamptz;
alter table public.relationship_invitations add column if not exists cancelled_by uuid references auth.users(id) on delete set null;

create unique index if not exists relationship_invitation_pending_target_uq
on public.relationship_invitations(requester_organization_id,target_organization_id)
where status='pending' and target_organization_id is not null;

create unique index if not exists relationship_invitation_pending_email_uq
on public.relationship_invitations(requester_organization_id,lower(invitee_email))
where status='pending' and invitee_email is not null and target_organization_id is null;

create or replace function public.ct_relationship_notify_members(
  p_org uuid,p_type text,p_title text,p_body text,p_entity uuid,p_dedupe_prefix text,p_severity text default 'info'
) returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(organization_id,user_id,type,severity,title,body,entity_type,entity_id,dedupe_key)
  select p_org,m.user_id,p_type,p_severity,p_title,p_body,'organization_relationship',p_entity,
         p_dedupe_prefix||':'||m.user_id::text
  from public.organization_members m
  left join public.notification_preferences np on np.organization_id=m.organization_id and np.user_id=m.user_id
  where m.organization_id=p_org and m.status='active'
    and m.role in ('owner','admin')
    and coalesce(np.in_app_enabled,true)=true
    and coalesce(np.relationship_notifications,true)=true
  on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
end; $$;
revoke all on function public.ct_relationship_notify_members(uuid,text,text,text,uuid,text,text) from public;
grant execute on function public.ct_relationship_notify_members(uuid,text,text,text,uuid,text,text) to authenticated;

create or replace function public.ct_create_relationship_invitation(p_requester_org uuid,p_lookup text)
returns public.relationship_invitations language plpgsql security definer set search_path=public as $$
declare
  term text:=lower(trim(p_lookup)); target public.organizations; inv public.relationship_invitations; rel public.organization_relationships;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not ct_has_org_role(p_requester_org,array['owner','admin','member']) then raise exception 'Insufficient permission'; end if;
  if term='' then raise exception 'VAT or email is required'; end if;

  select * into target from public.organizations o
  where o.deleted_at is null and o.status='active'
    and (lower(o.contact_email)=term or ct_normalize_vat(o.vat_number)=ct_normalize_vat(term))
  limit 1;

  if target.id is not null then
    if target.id=p_requester_org then raise exception 'Cannot invite your own organization'; end if;
    if exists(select 1 from public.organization_relationships r where r.status in ('pending','active','blocked')
      and ((r.requester_id=p_requester_org and r.partner_id=target.id) or (r.requester_id=target.id and r.partner_id=p_requester_org))) then
      raise exception 'Relationship already exists or is pending';
    end if;
    insert into public.organization_relationships(requester_id,partner_id,status,relationship_type,requested_by)
    values(p_requester_org,target.id,'pending','partner',auth.uid()) returning * into rel;

    insert into public.relationship_invitations(requester_organization_id,target_organization_id,invitee_email,invitee_country_code,invitee_vat_number,status,requested_by,relationship_id)
    values(p_requester_org,target.id,target.contact_email,target.country_code,target.vat_number,'pending',auth.uid(),rel.id)
    returning * into inv;

    perform public.ct_relationship_notify_members(target.id,'relationship_invite','Νέο αίτημα συνεργασίας',
      'Ένας οργανισμός σας έστειλε αίτημα συνεργασίας.',rel.id,'relationship-invite:'||rel.id::text,'info');
  else
    if position('@' in term)=0 then raise exception 'No registered organization was found. Use an email address to invite an unregistered organization'; end if;
    insert into public.relationship_invitations(requester_organization_id,invitee_email,status,requested_by)
    values(p_requester_org,term,'pending',auth.uid()) returning * into inv;
  end if;
  return inv;
end; $$;

create or replace function public.ct_respond_relationship(p_relationship uuid,p_accept boolean)
returns public.organization_relationships language plpgsql security definer set search_path=public as $$
declare r public.organization_relationships;
begin
  select * into r from public.organization_relationships where id=p_relationship for update;
  if r.id is null then raise exception 'Relationship not found'; end if;
  if r.status<>'pending' then raise exception 'Relationship is not pending'; end if;
  if not ct_has_org_role(r.partner_id,array['owner','admin']) then raise exception 'Only the invited organization owner/admin may respond'; end if;
  update public.organization_relationships set status=case when p_accept then 'active' else 'declined' end,
    accepted_by=case when p_accept then auth.uid() else null end,accepted_at=case when p_accept then now() else null end,updated_at=now()
  where id=p_relationship returning * into r;
  update public.relationship_invitations set status=case when p_accept then 'accepted' else 'declined' end,responded_at=now(),updated_at=now()
  where relationship_id=p_relationship and status='pending';
  perform public.ct_relationship_notify_members(r.requester_id,case when p_accept then 'relationship_accepted' else 'relationship_declined' end,
    case when p_accept then 'Η συνεργασία έγινε αποδεκτή' else 'Το αίτημα συνεργασίας απορρίφθηκε' end,
    case when p_accept then 'Ο συνεργαζόμενος οργανισμός αποδέχθηκε το αίτημά σας.' else 'Ο οργανισμός απέρριψε το αίτημά σας.' end,
    r.id,'relationship-response:'||r.id::text,case when p_accept then 'success' else 'warning' end);
  return r;
end; $$;

create or replace function public.ct_cancel_relationship_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path=public as $$
declare inv public.relationship_invitations;
begin
  select * into inv from public.relationship_invitations where id=p_invitation for update;
  if inv.id is null then return; end if;
  if inv.status<>'pending' then raise exception 'Invitation is not pending'; end if;
  if not ct_has_org_role(inv.requester_organization_id,array['owner','admin','member']) then raise exception 'Insufficient permission'; end if;
  update public.relationship_invitations set status='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),updated_at=now() where id=inv.id;
  if inv.relationship_id is not null then
    update public.organization_relationships set status='ended',ended_by=auth.uid(),ended_at=now(),end_reason='invitation_cancelled',updated_at=now()
    where id=inv.relationship_id and status='pending';
  end if;
end; $$;

grant execute on function public.ct_create_relationship_invitation(uuid,text) to authenticated;
grant execute on function public.ct_cancel_relationship_invitation(uuid) to authenticated;

-- Client invitation writes now go only through lifecycle RPCs.
drop policy if exists ct_relationship_invitations_insert on public.relationship_invitations;
revoke insert,update,delete on public.relationship_invitations from authenticated;
grant select on public.relationship_invitations to authenticated;

create or replace function public.organization_model_version()
returns text language sql stable security definer set search_path=public as $$ select '36'::text $$;
revoke all on function public.organization_model_version() from public;
grant execute on function public.organization_model_version() to anon,authenticated;
