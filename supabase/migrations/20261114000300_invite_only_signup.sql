-- Sign-up by invitation only.
-- A new organization can register only with an email that was invited:
--   * by the platform owner (organization_invitations, e.g. after a presentation), or
--   * by an organization already on CertiTrack that wants to connect (invitations).
-- Colleagues keep joining through team invitations (team_invitations).
-- The rule is enforced in the sign-up trigger, so it holds whatever calls the sign-up API.

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) between 3 and 254),
  organization_name text check (organization_name is null or length(organization_name) <= 200),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  accepted_at timestamptz
);
create unique index organization_invitations_pending_email_uq on public.organization_invitations(lower(email)) where status = 'pending';

alter table public.organization_invitations enable row level security;
create policy organization_invitations_select on public.organization_invitations for select to authenticated
  using (ct_is_platform_admin());
grant select on public.organization_invitations to authenticated;

-- The platform owner invites an organization; inviting again refreshes it and resends the email.
create function public.ct_invite_organization(p_email text, p_name text default null)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  v_email text := nullif(lower(trim(p_email)), '');
  v_name text := nullif(trim(p_name), '');
  v_id uuid;
begin
  if not ct_is_platform_admin() then raise exception 'Insufficient permission'; end if;
  if v_email is null or length(v_email) > 254 or v_email !~ '^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$' then raise exception 'Invalid email'; end if;
  if v_name is not null and length(v_name) > 200 then raise exception 'Invalid name'; end if;
  if exists(select 1 from auth.users where lower(email) = v_email) then raise exception 'This email already has a CertiTrack account'; end if;

  insert into organization_invitations(email, organization_name, invited_by)
  values (v_email, v_name, auth.uid())
  on conflict ((lower(email))) where status = 'pending'
  do update set organization_name = coalesce(excluded.organization_name, organization_invitations.organization_name),
                invited_by = excluded.invited_by, created_at = now(), expires_at = now() + interval '30 days'
  returning id into v_id;

  insert into email_outbox(recipient_email, template_key, subject, payload, dedupe_key)
  values (v_email, 'organization_invitation', 'CertiTrack — Πρόσκληση εγγραφής',
          jsonb_build_object('email', v_email, 'organization', v_name),
          'org-invite:' || v_id::text || ':' || extract(epoch from now())::bigint::text)
  on conflict (dedupe_key) do nothing;
  return v_id;
end;
$$;

create function public.ct_cancel_organization_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not ct_is_platform_admin() then raise exception 'Insufficient permission'; end if;
  update organization_invitations set status = 'cancelled' where id = p_invitation and status = 'pending';
  if not found then raise exception 'Invitation not found'; end if;
end;
$$;

revoke execute on function public.ct_invite_organization(text, text), public.ct_cancel_organization_invitation(uuid) from public, anon;
grant execute on function public.ct_invite_organization(text, text), public.ct_cancel_organization_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Sign-up trigger: organizations need an invitation
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
