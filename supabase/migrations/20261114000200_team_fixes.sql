-- Team fixes after review:
-- 1. Two administrators demoting or removing each other at the same moment
--    could both pass the "at least one administrator" check. Role changes and
--    removals now take a lock on the organization first, so they run one at a time.
-- 2. A colleague who was removed keeps their account, so inviting them again
--    was refused ("already has an account"). Inviting a former colleague now
--    restores their place in the team, as long as they do not belong to
--    another organization, and emails them that they can sign in again.

create or replace function public.ct_set_team_role(p_org uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public, private as $$
declare v_current text;
begin
  if not ct_has_org_role(p_org, array['owner','admin']) then raise exception 'Only an administrator may change roles'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Invalid role'; end if;
  perform 1 from organizations where id = p_org for update;   -- one team change at a time
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

create or replace function public.ct_remove_team_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare v_role text;
begin
  if not ct_has_org_role(p_org, array['owner','admin']) then raise exception 'Only an administrator may remove colleagues'; end if;
  perform 1 from organizations where id = p_org for update;   -- one team change at a time
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

create or replace function public.ct_invite_team_member(p_org uuid, p_email text, p_role text)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  v_email text := nullif(lower(trim(p_email)), '');
  v_user auth.users;
  v_id uuid;
begin
  if not ct_has_org_role(p_org, array['owner','admin']) then raise exception 'Only an administrator may invite colleagues'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Invalid role'; end if;
  if v_email is null or length(v_email) > 254 or v_email !~ '^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$' then raise exception 'Invalid email'; end if;
  if not ct_check_rate_limit('team-invite:' || p_org::text, 30, 86400) then raise exception 'Too many requests'; end if;

  select * into v_user from auth.users where lower(email) = v_email limit 1;
  if v_user.id is not null then
    -- A former colleague of this organization comes back; anyone else with an
    -- account is refused, since one account belongs to one organization.
    if not exists(select 1 from organization_members where organization_id = p_org and user_id = v_user.id and status = 'removed')
       or exists(select 1 from organization_members where user_id = v_user.id and status in ('active', 'pending_verification', 'suspended')) then
      raise exception 'This email already has a CertiTrack account';
    end if;
    update organization_members
       set status = case when v_user.email_confirmed_at is null then 'pending_verification' else 'active' end,
           role = p_role, removed_at = null
     where organization_id = p_org and user_id = v_user.id;
    insert into notification_preferences(organization_id, user_id) values (p_org, v_user.id) on conflict do nothing;
    insert into email_outbox(organization_id, recipient_email, template_key, subject, payload, dedupe_key)
    values (p_org, v_email, 'team_invitation', 'CertiTrack — Επιστροφή στην ομάδα της ' || ct_org_name(p_org),
            jsonb_build_object('organization', ct_org_name(p_org), 'role', p_role, 'email', v_email, 'rejoined', true),
            'team-rejoin:' || p_org::text || ':' || v_user.id::text || ':' || extract(epoch from now())::bigint::text)
    on conflict (dedupe_key) do nothing;
    return null;
  end if;

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
