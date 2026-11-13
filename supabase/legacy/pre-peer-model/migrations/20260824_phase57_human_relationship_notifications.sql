-- CertiTrack Phase 57
-- Human-readable relationship notifications.
-- Keeps UUIDs internally as entity identifiers, but never exposes them as notification copy.

create or replace function public.ct_create_relationship_invitation(
  p_requester_org uuid,
  p_lookup text
)
returns public.relationship_invitations
language plpgsql
security definer
set search_path=public
as $$
declare
  term text:=lower(trim(p_lookup));
  target public.organizations;
  requester_name text;
  inv public.relationship_invitations;
  rel public.organization_relationships;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not ct_has_org_role(p_requester_org,array['owner','admin','member']) then
    raise exception 'Insufficient permission';
  end if;
  if term='' then raise exception 'VAT or email is required'; end if;

  select coalesce(o.display_name,o.legal_name,'Οργανισμός')
    into requester_name
  from public.organizations o
  where o.id=p_requester_org;

  select * into target
  from public.organizations o
  where o.deleted_at is null
    and o.status='active'
    and (
      lower(o.contact_email)=term
      or ct_normalize_vat(o.vat_number)=ct_normalize_vat(term)
    )
  limit 1;

  if target.id is not null then
    if target.id=p_requester_org then
      raise exception 'Cannot invite your own organization';
    end if;

    if exists(
      select 1
      from public.organization_relationships r
      where r.status in ('pending','active','blocked')
        and (
          (r.requester_id=p_requester_org and r.partner_id=target.id)
          or
          (r.requester_id=target.id and r.partner_id=p_requester_org)
        )
    ) then
      raise exception 'Relationship already exists or is pending';
    end if;

    insert into public.organization_relationships(
      requester_id,partner_id,status,relationship_type,requested_by
    )
    values(
      p_requester_org,target.id,'pending','partner',auth.uid()
    )
    returning * into rel;

    insert into public.relationship_invitations(
      requester_organization_id,target_organization_id,invitee_email,
      invitee_country_code,invitee_vat_number,status,requested_by,relationship_id
    )
    values(
      p_requester_org,target.id,target.contact_email,
      target.country_code,target.vat_number,'pending',auth.uid(),rel.id
    )
    returning * into inv;

    perform public.ct_relationship_notify_members(
      target.id,
      'relationship_invite',
      'Νέο αίτημα συνεργασίας',
      coalesce(requester_name,'Ένας οργανισμός') || ' σας προσκαλεί σε συνεργασία στο CertiTrack.',
      rel.id,
      'relationship-invite:'||rel.id::text,
      'info'
    );
  else
    if position('@' in term)=0 then
      raise exception 'No registered organization was found. Use an email address to invite an unregistered organization';
    end if;

    insert into public.relationship_invitations(
      requester_organization_id,invitee_email,status,requested_by
    )
    values(
      p_requester_org,term,'pending',auth.uid()
    )
    returning * into inv;
  end if;

  return inv;
end;
$$;

grant execute on function public.ct_create_relationship_invitation(uuid,text) to authenticated;


create or replace function public.ct_respond_relationship(
  p_relationship uuid,
  p_accept boolean
)
returns public.organization_relationships
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.organization_relationships;
  responder_name text;
begin
  select * into r
  from public.organization_relationships
  where id=p_relationship
  for update;

  if r.id is null then raise exception 'Relationship not found'; end if;
  if r.status<>'pending' then raise exception 'Relationship is not pending'; end if;
  if not ct_has_org_role(r.partner_id,array['owner','admin']) then
    raise exception 'Only the invited organization owner/admin may respond';
  end if;

  select coalesce(o.display_name,o.legal_name,'Οργανισμός')
    into responder_name
  from public.organizations o
  where o.id=r.partner_id;

  update public.organization_relationships
  set status=case when p_accept then 'active' else 'declined' end,
      accepted_by=case when p_accept then auth.uid() else null end,
      accepted_at=case when p_accept then now() else null end,
      updated_at=now()
  where id=p_relationship
  returning * into r;

  update public.relationship_invitations
  set status=case when p_accept then 'accepted' else 'declined' end,
      responded_at=now(),
      updated_at=now()
  where relationship_id=p_relationship
    and status='pending';

  perform public.ct_relationship_notify_members(
    r.requester_id,
    case when p_accept then 'relationship_accepted' else 'relationship_declined' end,
    case when p_accept then 'Η συνεργασία έγινε αποδεκτή' else 'Το αίτημα συνεργασίας απορρίφθηκε' end,
    coalesce(responder_name,'Ο οργανισμός') ||
      case when p_accept then ' αποδέχθηκε το αίτημα συνεργασίας σας.'
           else ' απέρριψε το αίτημα συνεργασίας σας.' end,
    r.id,
    'relationship-response:'||r.id::text,
    case when p_accept then 'success' else 'warning' end
  );

  return r;
end;
$$;

grant execute on function public.ct_respond_relationship(uuid,boolean) to authenticated;
