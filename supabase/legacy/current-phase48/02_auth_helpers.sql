-- CertiTrack auth + helper functions
begin;
create or replace function public.ct_normalize_vat(value text)
returns text language sql immutable set search_path=public as $$
  select nullif(regexp_replace(upper(trim(coalesce(value,''))),'[^A-Z0-9]','','g'),'');
$$;

create or replace function public.ct_touch_updated_at()
returns trigger language plpgsql set search_path=public as $$ begin new.updated_at:=now(); return new; end; $$;

create or replace function public.ct_current_org_ids()
returns setof uuid language sql stable security definer set search_path=public as $$
 select organization_id from public.organization_members where user_id=auth.uid() and status='active';
$$;

create or replace function public.ct_is_org_member(p_org uuid,p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_user and status='active');
$$;

create or replace function public.ct_has_org_role(p_org uuid,p_roles text[],p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_user and status='active' and role=any(p_roles));
$$;

create or replace function public.ct_is_platform_admin(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.platform_admins where user_id=p_user and active=true);
$$;

create or replace function public.ct_handle_new_auth_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_name text; v_vat text; v_country text;
begin
 if coalesce(new.raw_user_meta_data->>'type','')<>'organization' then return new; end if;
 v_name:=nullif(trim(coalesce(new.raw_user_meta_data->>'organization_name',new.raw_user_meta_data->>'name')),'');
 v_vat:=public.ct_normalize_vat(coalesce(new.raw_user_meta_data->>'vat_number',new.raw_user_meta_data->>'afm'));
 v_country:=upper(coalesce(nullif(trim(new.raw_user_meta_data->>'country_code'),''),'GR'));
 if v_name is null then raise exception 'Organization name is required'; end if;
 if v_vat is null then raise exception 'VAT number is required'; end if;
 insert into public.organizations(legal_name,display_name,vat_number,country_code,contact_email,status,created_by)
 values(v_name,v_name,v_vat,v_country,new.email,'active',new.id) returning id into v_org;
 insert into public.organization_members(organization_id,user_id,role,status) values(v_org,new.id,'owner','active');
 insert into public.notification_preferences(organization_id,organization_name,user_id) values(v_org,v_name,new.id);
 return new;
exception when unique_violation then raise exception 'An organization with this VAT number already exists';
end; $$;

drop trigger if exists ct_on_auth_user_created on auth.users;
create trigger ct_on_auth_user_created after insert on auth.users for each row execute function public.ct_handle_new_auth_user();

-- updated_at triggers
DO $$ declare t text; begin
 foreach t in array array['organizations','organization_members','organization_relationships','certificate_types','certificates','relationship_requirements','notification_preferences','email_outbox'] loop
   execute format('drop trigger if exists ct_touch_%I on public.%I',t,t);
   execute format('create trigger ct_touch_%I before update on public.%I for each row execute function public.ct_touch_updated_at()',t,t);
 end loop;
end $$;
commit;
