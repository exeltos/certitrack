-- CertiTrack Phase 37 — Notifications, expiry engine and email outbox
-- Apply after Phase33, Phase35 and Phase36.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists vault;

-- -----------------------------------------------------------------------------
-- Notification preferences hardening
-- -----------------------------------------------------------------------------
alter table public.notification_preferences
  add column if not exists expiry_in_app_enabled boolean not null default true;
alter table public.notification_preferences
  add column if not exists expiry_email_enabled boolean not null default true;

-- -----------------------------------------------------------------------------
-- Server-side email outbox
-- Never expose provider/API secrets to the browser.
-- -----------------------------------------------------------------------------
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete cascade,
  recipient_email text not null,
  template_key text not null
    check (template_key in ('certificate_expiry','certificate_expired','relationship_invite','relationship_accepted','relationship_declined','system')),
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  status text not null default 'pending'
    check (status in ('pending','processing','sent','failed','cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  provider_message_id text,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_outbox_pending_idx
  on public.email_outbox(status,next_attempt_at,created_at)
  where status in ('pending','failed');

alter table public.email_outbox enable row level security;
-- No client policies. Only service-side processing may read/write the outbox.
revoke all on public.email_outbox from anon,authenticated;

drop trigger if exists ct_touch_updated_at on public.email_outbox;
create trigger ct_touch_updated_at before update on public.email_outbox
for each row execute procedure public.ct_touch_updated_at();

-- -----------------------------------------------------------------------------
-- Relationship email queue
-- Registered organizations respect user notification preferences.
-- Unregistered invitees receive the invitation at the supplied email.
-- -----------------------------------------------------------------------------
create or replace function public.ct_queue_relationship_invitation_email()
returns trigger
language plpgsql
security definer
set search_path=public,auth
as $$
declare requester_name text;
begin
  select coalesce(display_name,legal_name,'Οργανισμός') into requester_name
  from public.organizations where id=new.requester_organization_id;

  if new.target_organization_id is null then
    if new.invitee_email is not null then
      insert into public.email_outbox(
        organization_id,user_id,notification_id,recipient_email,template_key,subject,payload,dedupe_key
      ) values(
        new.requester_organization_id,null,null,new.invitee_email,'relationship_invite',
        'CertiTrack — Πρόσκληση συνεργασίας',
        jsonb_build_object('invitation_id',new.id,'requester_name',requester_name),
        'relationship-invite-email:'||new.id::text||':'||lower(new.invitee_email)
      ) on conflict (dedupe_key) do nothing;
    end if;
  else
    insert into public.email_outbox(
      organization_id,user_id,recipient_email,template_key,subject,payload,dedupe_key
    )
    select new.target_organization_id,m.user_id,u.email,'relationship_invite',
           'CertiTrack — Νέο αίτημα συνεργασίας',
           jsonb_build_object('invitation_id',new.id,'relationship_id',new.relationship_id,'requester_name',requester_name),
           'relationship-invite-email:'||new.id::text||':'||m.user_id::text
    from public.organization_members m
    join auth.users u on u.id=m.user_id
    left join public.notification_preferences np on np.organization_id=m.organization_id and np.user_id=m.user_id
    where m.organization_id=new.target_organization_id
      and m.status='active' and m.role in ('owner','admin')
      and u.email is not null
      and coalesce(np.email_enabled,true)=true
      and coalesce(np.relationship_notifications,true)=true
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists ct_queue_relationship_invitation_email on public.relationship_invitations;
create trigger ct_queue_relationship_invitation_email
after insert on public.relationship_invitations
for each row execute procedure public.ct_queue_relationship_invitation_email();

create or replace function public.ct_queue_relationship_response_email()
returns trigger
language plpgsql
security definer
set search_path=public,auth
as $$
declare partner_name text;
begin
  if old.status is not distinct from new.status or new.status not in ('accepted','declined') then return new; end if;

  if new.target_organization_id is not null then
    select coalesce(display_name,legal_name,'Οργανισμός') into partner_name
    from public.organizations where id=new.target_organization_id;
  else
    partner_name:=coalesce(new.invitee_email,'Οργανισμός');
  end if;

  insert into public.email_outbox(
    organization_id,user_id,recipient_email,template_key,subject,payload,dedupe_key
  )
  select new.requester_organization_id,m.user_id,u.email,
         case when new.status='accepted' then 'relationship_accepted' else 'relationship_declined' end,
         case when new.status='accepted' then 'CertiTrack — Η συνεργασία έγινε αποδεκτή'
              else 'CertiTrack — Το αίτημα συνεργασίας απορρίφθηκε' end,
         jsonb_build_object('invitation_id',new.id,'relationship_id',new.relationship_id,'partner_name',partner_name),
         'relationship-response-email:'||new.id::text||':'||new.status||':'||m.user_id::text
  from public.organization_members m
  join auth.users u on u.id=m.user_id
  left join public.notification_preferences np on np.organization_id=m.organization_id and np.user_id=m.user_id
  where m.organization_id=new.requester_organization_id
    and m.status='active' and m.role in ('owner','admin')
    and u.email is not null
    and coalesce(np.email_enabled,true)=true
    and coalesce(np.relationship_notifications,true)=true
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

drop trigger if exists ct_queue_relationship_response_email on public.relationship_invitations;
create trigger ct_queue_relationship_response_email
after update of status on public.relationship_invitations
for each row execute procedure public.ct_queue_relationship_response_email();

-- -----------------------------------------------------------------------------
-- Expiry notification generator
-- -----------------------------------------------------------------------------
create or replace function public.ct_generate_expiry_notifications(p_today date default current_date)
returns table(created_notifications integer, queued_emails integer)
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_notifications integer := 0;
  v_emails integer := 0;
  v_rows integer := 0;
begin
  -- Upcoming/expiry-day notification:
  -- choose the closest configured threshold >= days remaining.
  with candidates as (
    select
      c.id certificate_id,
      c.organization_id,
      c.title,
      c.expiry_date,
      m.user_id,
      u.email recipient_email,
      np.in_app_enabled,
      np.email_enabled,
      np.expiry_in_app_enabled,
      np.expiry_email_enabled,
      (
        select min(w)
        from unnest(coalesce(np.expiry_warning_days,array[90,60,30,15,7,0])) w
        where w >= (c.expiry_date - p_today) and (c.expiry_date - p_today) >= 0
      ) warning_day
    from public.certificates c
    join public.organization_members m
      on m.organization_id=c.organization_id
     and m.status='active'
     and m.role in ('owner','admin')
    join auth.users u on u.id=m.user_id
    left join public.notification_preferences np
      on np.organization_id=m.organization_id and np.user_id=m.user_id
    where c.deleted_at is null
      and c.expiry_date is not null
      and c.expiry_date >= p_today
      and coalesce(np.expiry_warning_days,array[90,60,30,15,7,0]) && array[0,1,3,7,14,15,30,45,60,90,120,180,365]
  ),
  inserted as (
    insert into public.notifications(
      organization_id,user_id,type,severity,title,body,entity_type,entity_id,dedupe_key,metadata
    )
    select
      x.organization_id,x.user_id,'certificate_expiry',
      case when x.warning_day=0 then 'critical'
           when x.warning_day<=7 then 'critical'
           when x.warning_day<=30 then 'warning'
           else 'info' end,
      case when x.warning_day=0 then 'Το πιστοποιητικό λήγει σήμερα'
           else 'Πιστοποιητικό προς λήξη' end,
      case when x.warning_day=0
           then x.title||' λήγει σήμερα.'
           else x.title||' λήγει σε '||x.warning_day::text||' ημέρες.' end,
      'certificate',x.certificate_id,
      'certificate-expiry:'||x.certificate_id::text||':'||x.warning_day::text,
      jsonb_build_object(
        'certificate_id',x.certificate_id,
        'certificate_title',x.title,
        'expiry_date',x.expiry_date,
        'warning_days',x.warning_day
      )
    from candidates x
    where x.warning_day is not null
      and coalesce(x.in_app_enabled,true)=true
      and coalesce(x.expiry_in_app_enabled,true)=true
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing
    returning *
  )
  select count(*) into v_notifications from inserted;

  -- Queue email independently from in-app preference, with its own dedupe.
  insert into public.email_outbox(
    organization_id,user_id,recipient_email,template_key,subject,payload,dedupe_key
  )
  select
    x.organization_id,x.user_id,x.recipient_email,'certificate_expiry',
    case when x.warning_day=0 then 'CertiTrack — Πιστοποιητικό λήγει σήμερα'
         else 'CertiTrack — Πιστοποιητικό προς λήξη' end,
    jsonb_build_object(
      'certificate_id',x.certificate_id,
      'certificate_title',x.title,
      'expiry_date',x.expiry_date,
      'warning_days',x.warning_day
    ),
    'certificate-expiry-email:'||x.certificate_id::text||':'||x.user_id::text||':'||x.warning_day::text
  from (
    select
      c.id certificate_id,c.organization_id,c.title,c.expiry_date,
      m.user_id,u.email recipient_email,
      np.email_enabled,np.expiry_email_enabled,
      (
        select min(w)
        from unnest(coalesce(np.expiry_warning_days,array[90,60,30,15,7,0])) w
        where w >= (c.expiry_date-p_today) and (c.expiry_date-p_today) >= 0
      ) warning_day
    from public.certificates c
    join public.organization_members m
      on m.organization_id=c.organization_id
     and m.status='active'
     and m.role in ('owner','admin')
    join auth.users u on u.id=m.user_id
    left join public.notification_preferences np
      on np.organization_id=m.organization_id and np.user_id=m.user_id
    where c.deleted_at is null and c.expiry_date is not null and c.expiry_date>=p_today
  ) x
  where x.warning_day is not null
    and x.recipient_email is not null
    and coalesce(x.email_enabled,true)=true
    and coalesce(x.expiry_email_enabled,true)=true
  on conflict (dedupe_key) do nothing;
  get diagnostics v_emails = row_count;

  -- Once overdue, create exactly one persistent "expired" notification/email per certificate/user.
  with expired_candidates as (
    select c.id certificate_id,c.organization_id,c.title,c.expiry_date,m.user_id,u.email recipient_email,
           np.in_app_enabled,np.email_enabled,np.expiry_in_app_enabled,np.expiry_email_enabled
    from public.certificates c
    join public.organization_members m
      on m.organization_id=c.organization_id and m.status='active' and m.role in ('owner','admin')
    join auth.users u on u.id=m.user_id
    left join public.notification_preferences np
      on np.organization_id=m.organization_id and np.user_id=m.user_id
    where c.deleted_at is null and c.expiry_date is not null and c.expiry_date < p_today
  ),
  inserted_expired as (
    insert into public.notifications(
      organization_id,user_id,type,severity,title,body,entity_type,entity_id,dedupe_key,metadata
    )
    select organization_id,user_id,'certificate_expired','critical','Ληγμένο πιστοποιητικό',
           title||' έχει λήξει.','certificate',certificate_id,
           'certificate-expired:'||certificate_id::text,
           jsonb_build_object('certificate_id',certificate_id,'certificate_title',title,'expiry_date',expiry_date)
    from expired_candidates
    where coalesce(in_app_enabled,true)=true and coalesce(expiry_in_app_enabled,true)=true
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing
    returning *
  )
  select v_notifications + count(*) into v_notifications from inserted_expired;

  insert into public.email_outbox(
    organization_id,user_id,recipient_email,template_key,subject,payload,dedupe_key
  )
  select organization_id,user_id,recipient_email,'certificate_expired',
         'CertiTrack — Ληγμένο πιστοποιητικό',
         jsonb_build_object('certificate_id',certificate_id,'certificate_title',title,'expiry_date',expiry_date),
         'certificate-expired-email:'||certificate_id::text||':'||user_id::text
  from expired_candidates
  where recipient_email is not null
    and coalesce(email_enabled,true)=true and coalesce(expiry_email_enabled,true)=true
  on conflict (dedupe_key) do nothing;
  get diagnostics v_rows = row_count;
  v_emails := v_emails + v_rows;

  return query select v_notifications,v_emails;
end;
$$;

revoke all on function public.ct_generate_expiry_notifications(date) from public;
-- Scheduled/server invocation only. Do not grant to anon/authenticated.

-- -----------------------------------------------------------------------------
-- Email worker helpers (service role only through Edge Function)
-- -----------------------------------------------------------------------------
create or replace function public.ct_claim_email_batch(p_worker text,p_limit integer default 50)
returns setof public.email_outbox
language plpgsql
security definer
set search_path=public
as $$
begin
  return query
  with picked as (
    select id
    from public.email_outbox
    where status in ('pending','failed')
      and next_attempt_at<=now()
      and attempts<5
      and (locked_at is null or locked_at < now()-interval '15 minutes')
    order by created_at
    for update skip locked
    limit greatest(1,least(p_limit,100))
  )
  update public.email_outbox q
     set status='processing',locked_at=now(),locked_by=p_worker,attempts=attempts+1,updated_at=now()
  from picked
  where q.id=picked.id
  returning q.*;
end;
$$;

create or replace function public.ct_complete_email(
  p_id uuid,p_success boolean,p_provider_message_id text default null,p_error text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.email_outbox
  set status=case
        when p_success then 'sent'
        when attempts>=5 then 'failed'
        else 'failed'
      end,
      provider_message_id=case when p_success then p_provider_message_id else provider_message_id end,
      sent_at=case when p_success then now() else sent_at end,
      last_error=case when p_success then null else left(coalesce(p_error,'Unknown delivery error'),2000) end,
      next_attempt_at=case
        when p_success then next_attempt_at
        else now() + make_interval(mins => least(240, power(2,greatest(attempts,1))::integer * 5))
      end,
      locked_at=null,locked_by=null,updated_at=now()
  where id=p_id;
end;
$$;

revoke all on function public.ct_claim_email_batch(text,integer) from public;
revoke all on function public.ct_complete_email(uuid,boolean,text,text) from public;
grant execute on function public.ct_generate_expiry_notifications(date) to service_role;
grant execute on function public.ct_claim_email_batch(text,integer) to service_role;
grant execute on function public.ct_complete_email(uuid,boolean,text,text) to service_role;

-- -----------------------------------------------------------------------------
-- User preferences RPC: a user may only change their own notification preferences.
-- -----------------------------------------------------------------------------
create or replace function public.ct_update_notification_preferences(
  p_organization uuid,
  p_in_app boolean,
  p_email boolean,
  p_expiry_in_app boolean,
  p_expiry_email boolean,
  p_warning_days integer[],
  p_relationship boolean,
  p_certificate_change boolean
)
returns public.notification_preferences
language plpgsql
security definer
set search_path=public
as $$
declare result public.notification_preferences;
begin
  if not ct_is_org_member(p_organization) then raise exception 'Insufficient permission'; end if;
  if not (p_warning_days <@ array[0,1,3,7,14,15,30,45,60,90,120,180,365]) then
    raise exception 'Invalid expiry warning days';
  end if;
  insert into public.notification_preferences(
    organization_id,user_id,in_app_enabled,email_enabled,expiry_in_app_enabled,expiry_email_enabled,
    expiry_warning_days,relationship_notifications,certificate_change_notifications
  ) values(
    p_organization,auth.uid(),p_in_app,p_email,p_expiry_in_app,p_expiry_email,
    p_warning_days,p_relationship,p_certificate_change
  )
  on conflict (organization_id,user_id) do update set
    in_app_enabled=excluded.in_app_enabled,
    email_enabled=excluded.email_enabled,
    expiry_in_app_enabled=excluded.expiry_in_app_enabled,
    expiry_email_enabled=excluded.expiry_email_enabled,
    expiry_warning_days=excluded.expiry_warning_days,
    relationship_notifications=excluded.relationship_notifications,
    certificate_change_notifications=excluded.certificate_change_notifications,
    updated_at=now()
  returning * into result;
  return result;
end;
$$;
grant execute on function public.ct_update_notification_preferences(uuid,boolean,boolean,boolean,boolean,integer[],boolean,boolean) to authenticated;

create or replace function public.organization_model_version()
returns text language sql stable security definer set search_path=public as $$ select '37'::text $$;
revoke all on function public.organization_model_version() from public;
grant execute on function public.organization_model_version() to anon,authenticated;
