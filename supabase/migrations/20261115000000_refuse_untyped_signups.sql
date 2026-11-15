-- Close the last open door of the public sign-up: an account with no type (or an
-- unknown one) was still created, without an organization. Bots used it with
-- throw-away addresses, and each one got a confirmation email from our server.
-- Now such sign-ups are refused like any other sign-up without an invitation.

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

  -- Anything else that comes through the public sign-up (no type, or an unknown one) is
  -- refused: it arrives unconfirmed. Accounts the owner adds in the Supabase dashboard are
  -- created already confirmed and are let through (e.g. another platform administrator).
  if coalesce(new.raw_user_meta_data->>'type', '') <> 'organization' then
    if new.email_confirmed_at is null then raise exception 'Sign-up needs an invitation'; end if;
    return new;
  end if;

  -- Invited by the platform owner, or by an organization that wants to connect.
  if not exists(select 1 from organization_invitations
                 where lower(email) = lower(new.email) and status = 'pending' and expires_at > now())
     and not exists(select 1 from invitations
                     where lower(email) = lower(new.email) and status = 'pending' and expires_at > now()) then
    raise exception 'Sign-up needs an invitation';
  end if;
  if v_name is null or v_vat is null then raise exception 'Organization name and VAT number are required'; end if;

  insert into organizations(legal_name, display_name, country_code, vat_number, contact_email, status, created_by)
  values (v_name, v_name, v_country, v_vat, new.email, 'pending_verification', new.id)
  returning id into v_org;
  insert into organization_members(organization_id, user_id, role, status)
  values (v_org, new.id, 'owner', 'pending_verification');
  insert into notification_preferences(organization_id, user_id) values (v_org, new.id);
  update organization_invitations set status = 'accepted', accepted_at = now()
   where lower(email) = lower(new.email) and status = 'pending';

  if v_state = 'active' then perform ct_activate_user_organizations(new.id, new.email); end if;
  return new;
exception when unique_violation then
  raise exception 'An organization with this VAT number already exists';
end;
$$;
