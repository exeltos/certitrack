-- Contact details shown on the public home page ("Ζητήστε παρουσίαση" card).
-- Anyone may read them; only a platform administrator may change them, through
-- ct_set_site_contact(), which validates every field.

create table public.site_settings (
  key        text primary key check (key in ('contact')),
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.site_settings enable row level security;
create policy site_settings_read on public.site_settings for select to anon, authenticated using (true);
grant select on public.site_settings to anon, authenticated;

insert into public.site_settings(key, value) values ('contact', jsonb_build_object(
  'company', 'Exeltos', 'email', 'info@exeltos.com', 'phone', '6942471022', 'website', 'https://exeltos.com'))
on conflict (key) do nothing;

create function public.ct_set_site_contact(p_company text, p_email text, p_phone text, p_website text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_company text := nullif(trim(p_company), '');
  v_email   text := nullif(lower(trim(p_email)), '');
  v_phone   text := nullif(trim(p_phone), '');
  v_website text := nullif(trim(p_website), '');
  v_old jsonb;
  v_new jsonb;
begin
  if not ct_is_platform_admin() then raise exception 'Platform administrator required'; end if;
  if v_company is null or length(v_company) > 120 then raise exception 'Invalid company name'; end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$') then
    raise exception 'Invalid email';
  end if;
  if v_phone is not null and (length(v_phone) > 40 or v_phone !~ '^\+?[0-9 ().-]{5,}$') then raise exception 'Invalid phone'; end if;
  if v_website is not null then
    if v_website !~* '^https?://' then v_website := 'https://' || v_website; end if;
    -- Only plain web addresses: the value becomes a link on the public page.
    if length(v_website) > 200 or v_website !~* '^https?://[a-z0-9.-]+\.[a-z]{2,}(:[0-9]+)?(/[^\s<>"]*)?$' then
      raise exception 'Invalid website';
    end if;
  end if;

  select value into v_old from site_settings where key = 'contact';
  v_new := jsonb_build_object('company', v_company, 'email', v_email, 'phone', v_phone, 'website', v_website);
  insert into site_settings(key, value, updated_at, updated_by) values ('contact', v_new, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  insert into audit_log(actor_user_id, action, entity_type, old_data, new_data)
  values (auth.uid(), 'site_contact.updated', 'site_settings', v_old, v_new);
  return v_new;
end $$;

revoke execute on function public.ct_set_site_contact(text, text, text, text) from public, anon;
grant execute on function public.ct_set_site_contact(text, text, text, text) to authenticated;
