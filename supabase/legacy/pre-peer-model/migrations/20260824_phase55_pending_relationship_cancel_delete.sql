-- CertiTrack Phase 55 — pending relationship cancellation hard-delete

create or replace function public.ct_cancel_relationship(p_relationship uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.organization_relationships;
begin
  select * into r
  from public.organization_relationships
  where id=p_relationship
  for update;

  if r.id is null then
    return;
  end if;

  if r.status <> 'pending' then
    raise exception 'Only a pending relationship request can be cancelled';
  end if;

  if not public.ct_has_org_role(r.requester_id,array['owner','admin','member']) then
    raise exception 'Insufficient permission';
  end if;

  delete from public.relationship_invitations
  where relationship_id=p_relationship
    and status='pending';

  delete from public.email_outbox
  where template_key='relationship_invite'
    and payload->>'relationship_id'=p_relationship::text
    and status in ('pending','processing','failed');

  delete from public.organization_relationships
  where id=p_relationship;
end;
$$;

grant execute on function public.ct_cancel_relationship(uuid) to authenticated;
