-- "Request a presentation" from the public home page.
-- A visitor sends the form through ct_submit_presentation_request(): the
-- request is stored here and an email goes to the contact address of the home
-- page (site_settings 'contact'), sent by process-notifications. Only platform
-- administrators can read the requests and mark them as handled.

create table public.presentation_requests (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 1 and 120),
  company    text not null check (length(company) between 1 and 160),
  email      text not null check (length(email) between 3 and 254),
  phone      text check (length(phone) <= 40),
  message    text check (length(message) <= 2000),
  status     text not null default 'new' check (status in ('new', 'contacted', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  handled_by uuid
);
create index presentation_requests_status_idx on public.presentation_requests(status, created_at desc);
create trigger ct_touch_updated_at before update on public.presentation_requests
  for each row execute procedure public.ct_touch_updated_at();

alter table public.presentation_requests enable row level security;
create policy presentation_requests_admin_read on public.presentation_requests for select to authenticated
  using (ct_is_platform_admin());
grant select on public.presentation_requests to authenticated;

create function public.ct_submit_presentation_request(
  p_name text, p_company text, p_email text, p_phone text default null, p_message text default null, p_trap text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_name    text := nullif(trim(p_name), '');
  v_company text := nullif(trim(p_company), '');
  v_email   text := nullif(lower(trim(p_email)), '');
  v_phone   text := nullif(trim(p_phone), '');
  v_message text := nullif(trim(p_message), '');
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_ip      text := coalesce(trim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), '');
  v_to      text;
  v_id      uuid;
begin
  -- A hidden field people never see: bots fill it. Answer as if all went well.
  if nullif(trim(p_trap), '') is not null then return; end if;

  if v_name is null or length(v_name) > 120 or v_name ~ '[[:cntrl:]]' then raise exception 'Invalid name'; end if;
  if v_company is null or length(v_company) > 160 or v_company ~ '[[:cntrl:]]' then raise exception 'Invalid company'; end if;
  if v_email is null or length(v_email) > 254 or v_email !~ '^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$' then raise exception 'Invalid email'; end if;
  if v_phone is not null and (length(v_phone) > 40 or v_phone !~ '^\+?[0-9 ().-]{5,}$') then raise exception 'Invalid phone'; end if;
  if v_message is not null and length(v_message) > 2000 then raise exception 'Invalid message'; end if;

  -- Against floods: per sender address, per network address, and overall.
  if not ct_check_rate_limit('presentation:email:' || v_email, 3, 86400)
     or not ct_check_rate_limit('presentation:ip:' || md5(v_ip), 5, 3600)
     or not ct_check_rate_limit('presentation:all', 60, 3600) then
    raise exception 'Too many requests';
  end if;

  insert into presentation_requests(name, company, email, phone, message)
  values (v_name, v_company, v_email, v_phone, v_message)
  returning id into v_id;

  select nullif(value ->> 'email', '') into v_to from site_settings where key = 'contact';
  insert into email_outbox(recipient_email, template_key, subject, payload, dedupe_key)
  values (coalesce(v_to, 'info@exeltos.com'), 'presentation_request', 'CertiTrack — Αίτημα παρουσίασης: ' || v_company,
          jsonb_build_object('id', v_id, 'name', v_name, 'company', v_company, 'email', v_email, 'phone', v_phone, 'message', v_message),
          'presentation:' || v_id::text);
end $$;

create function public.ct_set_presentation_request_status(p_request uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not ct_is_platform_admin() then raise exception 'Platform administrator required'; end if;
  if p_status not in ('new', 'contacted', 'done') then raise exception 'Invalid status'; end if;
  update presentation_requests set status = p_status, handled_by = auth.uid() where id = p_request;
  if not found then raise exception 'Request not found'; end if;
end $$;

revoke execute on function public.ct_submit_presentation_request(text, text, text, text, text, text) from public;
grant execute on function public.ct_submit_presentation_request(text, text, text, text, text, text) to anon, authenticated;
revoke execute on function public.ct_set_presentation_request_status(uuid, text) from public, anon;
grant execute on function public.ct_set_presentation_request_status(uuid, text) to authenticated;
