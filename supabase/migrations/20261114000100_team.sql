-- Team: several people of the same organization, with two levels.
--
--   Διαχειριστής (owner, admin): everything, plus inviting/removing colleagues,
--     changing their level, editing the organization's details, ending a
--     connection and closing the account.
--   Μέλος (member): the daily work: certificates (add, edit, share, delete),
--     connections (ask, accept, decline) and document requests (ask, answer,
--     decline).
--
-- Between organizations nothing changes: all are equal peers.
--
-- A colleague is invited by email. They sign up with that email (sign-up type
-- 'team_member') and, once the email is verified, join the organization.

-- ---------------------------------------------------------------------------
-- Members may now do the daily work that used to need an owner/admin
-- ---------------------------------------------------------------------------
create or replace function public.ct_respond_connection(p_connection uuid, p_accept boolean)
returns public.connections language plpgsql security definer set search_path = public, private as $$
declare c public.connections;
begin
  select * into c from public.connections where id = p_connection for update;
  if c.id is null then raise exception 'Connection not found'; end if;
  if c.status <> 'pending' then raise exception 'Connection is not pending'; end if;
  if not ct_has_org_role(c.addressee_org_id, array['owner','admin','member']) then
    raise exception 'Only a member of the invited organization may respond';
  end if;
  update public.connections
     set status = case when p_accept then 'active' else 'declined' end,
         responded_by = auth.uid(), responded_at = now()
   where id = p_connection returning * into c;
  perform ct_notify_org(c.requester_org_id,
    case when p_accept then 'connection_accepted' else 'connection_declined' end,
    case when p_accept then 'success' else 'warning' end,
    case when p_accept then 'Η σύνδεση ενεργοποιήθηκε' else 'Το αίτημα σύνδεσης απορρίφθηκε' end,
    ct_org_name(c.addressee_org_id) ||
      case when p_accept then ' αποδέχθηκε το αίτημα σύνδεσης.' else ' απέρριψε το αίτημα σύνδεσης.' end,
    'connection', c.id, 'connection-response:' || c.id::text, 'relationship',
    jsonb_build_object('partner_name', ct_org_name(c.addressee_org_id)),
    case when p_accept then 'connection_accepted' end);
  return c;
end;
$$;

create or replace function public.ct_soft_delete_certificate(p_certificate uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare c public.certificates;
begin
  select * into c from public.certificates where id = p_certificate and deleted_at is null for update;
  if c.id is null then return; end if;
  if not ct_has_org_role(c.organization_id, array['owner','admin','member']) then
    raise exception 'Only members of the organization may delete certificates';
  end if;
  update public.certificates set deleted_at = now(), deleted_by = auth.uid() where id = c.id;
  delete from public.certificate_shares where certificate_id = c.id;
end;
$$;

create or replace function public.ct_decline_document_request(p_request uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public, private as $$
declare r public.document_requests; v_type text;
begin
  select * into r from public.document_requests where id = p_request for update;
  if r.id is null then raise exception 'Request not found'; end if;
  if not ct_has_org_role(r.responder_org_id, array['owner','admin','member']) then raise exception 'Insufficient permission'; end if;
  if r.status <> 'open' then raise exception 'Request is not open'; end if;
  update public.document_requests
     set status = 'declined', response_note = nullif(trim(p_note), ''), resolved_by = auth.uid(), resolved_at = now()
   where id = r.id;
  select name into v_type from public.certificate_types where id = r.certificate_type_id;
  perform ct_notify_org(r.requester_org_id, 'document_request_declined', 'warning', 'Το αίτημα εγγράφου απορρίφθηκε',
    ct_org_name(r.responder_org_id) || ' απέρριψε το αίτημα για ' || v_type ||
      coalesce(': ' || nullif(trim(p_note), ''), '.'),
    'document_request', r.id, 'document-request-declined:' || r.id::text, 'partner_certificate',
    jsonb_build_object('partner_name', ct_org_name(r.responder_org_id), 'certificate_type', v_type));
end;
$$;

-- Any Διαχειριστής (not only the person who signed up) may close the account.
create or replace function public.ct_request_organization_closure(p_org uuid, p_reason text default null)
returns public.organizations language plpgsql security definer set search_path = public, private as $$
declare o public.organizations;
begin
  if not ct_has_org_role(p_org, array['owner','admin']) then raise exception 'Only an administrator may request organization closure'; end if;
  update public.organizations
     set status = 'closure_requested', closure_requested_at = now(), closure_requested_by = auth.uid(),
         closure_reason = nullif(trim(p_reason), '')
   where id = p_org and status = 'active' returning * into o;
  if o.id is null then raise exception 'Organization is not active'; end if;
  return o;
end;
$$;

create or replace function public.ct_cancel_organization_closure(p_org uuid)
returns public.organizations language plpgsql security definer set search_path = public, private as $$
declare o public.organizations;
begin
  if not ct_has_org_role(p_org, array['owner','admin']) then raise exception 'Only an administrator may cancel closure'; end if;
  update public.organizations
     set status = 'active', closure_requested_at = null, closure_requested_by = null, closure_reason = null
   where id = p_org and status = 'closure_requested' returning * into o;
  if o.id is null then raise exception 'No closure request is pending'; end if;
  return o;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invitations to join a team
-- ---------------------------------------------------------------------------
create table public.team_invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           text not null check (length(email) between 3 and 254),
  role            text not null check (role in ('admin', 'member')),
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  invited_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '14 days',
  accepted_at     timestamptz
);
-- A person can be invited by one organization at a time.
create unique index team_invitations_pending_email_uq on public.team_invitations(lower(email)) where status = 'pending';
create index team_invitations_org_idx on public.team_invitations(organization_id, status);

alter table public.team_invitations enable row level security;
create policy team_invitations_select on public.team_invitations for select to authenticated
  using (ct_is_platform_admin() or private.ct_is_org_member(organization_id));
grant select on public.team_invitations to authenticated;

-- Everyone in the team can see who is in it; only administrators change it.
create function public.ct_team(p_org uuid)
returns table(user_id uuid, email text, role text, status text, joined_at timestamptz, is_me boolean)
language plpgsql stable security definer set search_path = public, private as $$
begin
  if not (ct_is_org_member(p_org) or ct_is_platform_admin()) then raise exception 'Insufficient permission'; end if;
  return query
  select m.user_id, u.email::text, m.role, m.status, m.created_at, m.user_id = auth.uid()
  from public.organization_members m join auth.users u on u.id = m.user_id
  where m.organization_id = p_org and m.status in ('active', 'pending_verification')
  order by (m.role in ('owner', 'admin')) desc, m.created_at;
end;
$$;

create function public.ct_invite_team_member(p_org uuid, p_email text, p_role text)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  v_email text := nullif(lower(trim(p_email)), '');
  v_id uuid;
begin
  if not ct_has_org_role(p_org, array['owner','admin']) then raise exception 'Only an administrator may invite colleagues'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Invalid role'; end if;
  if v_email is null or length(v_email) > 254 or v_email !~ '^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$' then raise exception 'Invalid email'; end if;
  if not ct_check_rate_limit('team-invite:' || p_org::text, 30, 86400) then raise exception 'Too many requests'; end if;
  -- One account belongs to one organization.
  if exists(select 1 from auth.users where lower(email) = v_email) then raise exception 'This email already has a CertiTrack account'; end if;
  if exists(select 1 from team_invitations where lower(email) = v_email and status = 'pending'
            and organization_id <> p_org and expires_at > now()) then
    raise exception 'This email has already been invited by another organization';
  end if;
  -- Expired invitations elsewhere no longer block this one.
  update team_invitations set status = 'cancelled'
   where lower(email) = v_email and status = 'pending' and organization_id <> p_org and expires_at <= now();

  -- Inviting again refreshes the invitation and sends a new email.
  insert into team_invitations(organization_id, email, role, invited_by)
  values (p_org, v_email, p_role, auth.uid())
  on conflict ((lower(email))) where status = 'pending'
  do update set role = excluded.role, invited_by = excluded.invited_by, created_at = now(), expires_at = now() + interval '14 days'
  returning id into v_id;

  insert into email_outbox(organization_id, recipient_email, template_key, subject, payload, dedupe_key)
  values (p_org, v_email, 'team_invitation', 'CertiTrack — Πρόσκληση στην ομάδα της ' || ct_org_name(p_org),
          jsonb_build_object('organization', ct_org_name(p_org), 'role', p_role, 'email', v_email),
          'team-invite:' || v_id::text || ':' || extract(epoch from now())::bigint::text)
  on conflict (dedupe_key) do nothing;
  return v_id;
end;
$$;

create function public.ct_cancel_team_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare v_org uuid;
begin
  select organization_id into v_org from team_invitations where id = p_invitation and status = 'pending';
  if v_org is null then raise exception 'Invitation not found'; end if;
  if not ct_has_org_role(v_org, array['owner','admin']) then raise exception 'Only an administrator may cancel invitations'; end if;
  update team_invitations set status = 'cancelled' where id = p_invitation;
end;
$$;

-- The team must always keep at least one administrator.
create function public.ct_set_team_role(p_org uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public, private as $$
declare v_current text;
begin
  if not ct_has_org_role(p_org, array['owner','admin']) then raise exception 'Only an administrator may change roles'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Invalid role'; end if;
  select role into v_current from organization_members
   where organization_id = p_org and user_id = p_user and status in ('active', 'pending_verification') for update;
  if v_current is null then raise exception 'Member not found'; end if;
  if p_role = 'member' and v_current in ('owner', 'admin')
     and (select count(*) from organization_members where organization_id = p_org and status = 'active'
          and role in ('owner', 'admin') and user_id <> p_user) = 0 then
    raise exception 'The team needs at least one administrator';
  end if;
  -- The person who signed up stays 'owner' while an administrator.
  if not (v_current = 'owner' and p_role = 'admin') then
    update organization_members set role = p_role where organization_id = p_org and user_id = p_user;
  end if;
end;
$$;

create function public.ct_remove_team_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare v_role text;
begin
  if not ct_has_org_role(p_org, array['owner','admin']) then raise exception 'Only an administrator may remove colleagues'; end if;
  select role into v_role from organization_members
   where organization_id = p_org and user_id = p_user and status in ('active', 'pending_verification') for update;
  if v_role is null then raise exception 'Member not found'; end if;
  if v_role in ('owner', 'admin')
     and (select count(*) from organization_members where organization_id = p_org and status = 'active'
          and role in ('owner', 'admin') and user_id <> p_user) = 0 then
    raise exception 'The team needs at least one administrator';
  end if;
  update organization_members set status = 'removed', removed_at = now() where organization_id = p_org and user_id = p_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sign-up: an invited colleague joins the organization that invited them
-- ---------------------------------------------------------------------------
create or replace function public.ct_handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare
  v_org uuid;
  v_country text := upper(coalesce(nullif(new.raw_user_meta_data->>'country_code',''), 'GR'));
  v_vat text := ct_normalize_vat(new.raw_user_meta_data->>'afm');
  v_name text := nullif(trim(new.raw_user_meta_data->>'name'), '');
  v_state text := case when new.email_confirmed_at is null then 'pending_verification' else 'active' end;
  v_inv public.team_invitations;
begin
  if coalesce(new.raw_user_meta_data->>'type', '') = 'team_member' then
    select * into v_inv from team_invitations
     where lower(email) = lower(new.email) and status = 'pending' and expires_at > now() for update;
    if v_inv.id is null then raise exception 'There is no pending team invitation for this email'; end if;
    insert into organization_members(organization_id, user_id, role, status)
    values (v_inv.organization_id, new.id, v_inv.role, 'pending_verification');
    insert into notification_preferences(organization_id, user_id) values (v_inv.organization_id, new.id);
    update team_invitations set status = 'accepted', accepted_at = now() where id = v_inv.id;
    if v_state = 'active' then perform ct_activate_user_organizations(new.id, new.email); end if;
    return new;
  end if;

  if coalesce(new.raw_user_meta_data->>'type', '') <> 'organization' then return new; end if;
  if v_name is null or v_vat is null then raise exception 'Organization name and VAT number are required'; end if;

  insert into organizations(legal_name, display_name, country_code, vat_number, contact_email, status, created_by)
  values (v_name, v_name, v_country, v_vat, new.email, 'pending_verification', new.id)
  returning id into v_org;
  insert into organization_members(organization_id, user_id, role, status)
  values (v_org, new.id, 'owner', 'pending_verification');
  insert into notification_preferences(organization_id, user_id) values (v_org, new.id);

  if v_state = 'active' then perform ct_activate_user_organizations(new.id, new.email); end if;
  return new;
exception when unique_violation then
  raise exception 'An organization with this VAT number already exists';
end;
$$;

revoke execute on function
  public.ct_team(uuid),
  public.ct_invite_team_member(uuid, text, text),
  public.ct_cancel_team_invitation(uuid),
  public.ct_set_team_role(uuid, uuid, text),
  public.ct_remove_team_member(uuid, uuid)
from public, anon;
grant execute on function
  public.ct_team(uuid),
  public.ct_invite_team_member(uuid, text, text),
  public.ct_cancel_team_invitation(uuid),
  public.ct_set_team_role(uuid, uuid, text),
  public.ct_remove_team_member(uuid, uuid)
to authenticated;
