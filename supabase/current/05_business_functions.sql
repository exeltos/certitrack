-- Snapshots, audit and partner business functions
begin;
create or replace function public.ct_fill_certificate_snapshots() returns trigger language plpgsql security definer set search_path=public as $$
declare v_org_name text; v_code text; v_name text;
begin
 select coalesce(display_name,legal_name) into v_org_name from public.organizations where id=new.organization_id;
 if v_org_name is null then raise exception 'Invalid organization'; end if;
 if new.certificate_type_id is not null then
   select code,name into v_code,v_name from public.certificate_types where id=new.certificate_type_id and active=true;
   if v_code is null then raise exception 'Invalid or inactive certificate type'; end if;
   new.certificate_type_code:=v_code; new.certificate_type_name:=v_name;
 elsif nullif(trim(new.certificate_type_code),'') is null or nullif(trim(new.certificate_type_name),'') is null then
   raise exception 'Certificate type code and name are required';
 end if;
 new.organization_name:=v_org_name; return new;
end $$;
drop trigger if exists ct_fill_certificate_snapshots on public.certificates;
create trigger ct_fill_certificate_snapshots before insert or update of organization_id,certificate_type_id on public.certificates for each row execute function public.ct_fill_certificate_snapshots();

create or replace function public.ct_fill_certificate_file_snapshots() returns trigger language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_org_name text; v_type text;
begin
 select organization_id,organization_name,certificate_type_name into v_org,v_org_name,v_type from public.certificates where id=new.certificate_id and deleted_at is null;
 if v_org is null then raise exception 'Invalid certificate'; end if;
 new.organization_id:=v_org; new.organization_name:=v_org_name; new.certificate_type_name:=v_type; return new;
end $$;
drop trigger if exists ct_fill_certificate_file_snapshots on public.certificate_files;
create trigger ct_fill_certificate_file_snapshots before insert or update of certificate_id on public.certificate_files for each row execute function public.ct_fill_certificate_file_snapshots();

create or replace function public.ct_fill_requirement_snapshots() returns trigger language plpgsql security definer set search_path=public as $$
declare a uuid; b uuid; an text; bn text; tc text; tn text;
begin
 select requester_organization_id,partner_organization_id into a,b from public.organization_relationships where id=new.relationship_id;
 if a is null or b is null then raise exception 'Invalid organization relationship'; end if;
 select coalesce(display_name,legal_name) into an from public.organizations where id=a;
 select coalesce(display_name,legal_name) into bn from public.organizations where id=b;
 select code,name into tc,tn from public.certificate_types where id=new.certificate_type_id and active=true;
 if tc is null then raise exception 'Invalid or inactive certificate type'; end if;
 new.requester_organization_id:=a; new.partner_organization_id:=b; new.requester_organization_name:=an; new.partner_organization_name:=bn; new.certificate_type_code:=tc; new.certificate_type_name:=tn; return new;
end $$;
drop trigger if exists ct_fill_requirement_snapshots on public.relationship_requirements;
create trigger ct_fill_requirement_snapshots before insert or update of relationship_id,certificate_type_id on public.relationship_requirements for each row execute function public.ct_fill_requirement_snapshots();

create or replace function public.ct_write_audit(p_org uuid,p_org_name text,p_action text,p_entity_type text,p_entity_id text,p_entity_name text,p_old jsonb,p_new jsonb,p_metadata jsonb default '{}'::jsonb,p_actor uuid default auth.uid()) returns void language plpgsql security definer set search_path=public as $$
declare e text; begin select email into e from auth.users where id=p_actor; insert into public.audit_log(organization_id,organization_name,actor_user_id,actor_email,action,entity_type,entity_id,entity_name,old_values,new_values,metadata) values(p_org,p_org_name,p_actor,e,p_action,p_entity_type,p_entity_id,p_entity_name,p_old,p_new,coalesce(p_metadata,'{}'::jsonb)); end $$;

create or replace function public.ct_audit_certificate() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then perform public.ct_write_audit(new.organization_id,new.organization_name,'created','certificate',new.id::text,new.certificate_type_name,null,to_jsonb(new)); return new;
 elsif tg_op='UPDATE' then perform public.ct_write_audit(new.organization_id,new.organization_name,'updated','certificate',new.id::text,new.certificate_type_name,to_jsonb(old),to_jsonb(new)); return new;
 else perform public.ct_write_audit(old.organization_id,old.organization_name,'deleted','certificate',old.id::text,old.certificate_type_name,to_jsonb(old),null); return old; end if;
end $$;
drop trigger if exists ct_audit_certificate on public.certificates;
create trigger ct_audit_certificate after insert or update or delete on public.certificates for each row execute function public.ct_audit_certificate();

create or replace function public.ct_find_partner_candidate(p_lookup text)
returns table(id uuid,name text,afm text,email text) language sql stable security definer set search_path=public as $$
 select o.id,coalesce(o.display_name,o.legal_name),o.vat_number,o.contact_email from public.organizations o where o.status='active' and o.id not in(select public.ct_current_org_ids()) and (upper(o.vat_number)=upper(public.ct_normalize_vat(p_lookup)) or lower(coalesce(o.contact_email,''))=lower(trim(p_lookup))) limit 1;
$$;

create or replace function public.ct_request_relationship(p_requester_org uuid,p_lookup text) returns uuid language plpgsql security definer set search_path=public as $$
declare target uuid; an text; bn text; rid uuid;
begin
 if not public.ct_has_org_role(p_requester_org,array['owner','admin']) then raise exception 'Not allowed'; end if;
 select id into target from public.organizations where status='active' and id<>p_requester_org and (upper(vat_number)=upper(public.ct_normalize_vat(p_lookup)) or lower(coalesce(contact_email,''))=lower(trim(p_lookup))) limit 1;
 if target is null then raise exception 'Ο οργανισμός δεν είναι ακόμη εγγεγραμμένος στο CertiTrack.'; end if;
 select coalesce(display_name,legal_name) into an from public.organizations where id=p_requester_org;
 select coalesce(display_name,legal_name) into bn from public.organizations where id=target;
 if exists(select 1 from public.organization_relationships where (requester_organization_id=p_requester_org and partner_organization_id=target) or (requester_organization_id=target and partner_organization_id=p_requester_org)) then raise exception 'Υπάρχει ήδη σχέση ή εκκρεμές αίτημα με αυτόν τον οργανισμό.'; end if;
 insert into public.organization_relationships(requester_organization_id,partner_organization_id,requester_name,partner_name,status,requested_by) values(p_requester_org,target,an,bn,'pending',auth.uid()) returning id into rid; return rid;
end $$;

create or replace function public.ct_respond_relationship(p_relationship uuid,p_accept boolean) returns void language plpgsql security definer set search_path=public as $$
declare r public.organization_relationships%rowtype; begin select * into r from public.organization_relationships where id=p_relationship; if r.id is null then raise exception 'Relationship not found'; end if; if not public.ct_has_org_role(r.partner_organization_id,array['owner','admin']) then raise exception 'Not allowed'; end if; update public.organization_relationships set status=case when p_accept then 'active' else 'rejected' end,accepted_by=case when p_accept then auth.uid() else null end where id=p_relationship and status='pending'; end $$;

create or replace function public.ct_end_relationship(p_relationship uuid) returns void language plpgsql security definer set search_path=public as $$
declare r public.organization_relationships%rowtype; begin select * into r from public.organization_relationships where id=p_relationship; if r.id is null then raise exception 'Relationship not found'; end if; if not(public.ct_has_org_role(r.requester_organization_id,array['owner','admin']) or public.ct_has_org_role(r.partner_organization_id,array['owner','admin'])) then raise exception 'Not allowed'; end if; update public.organization_relationships set status='ended' where id=p_relationship; end $$;

revoke all on function public.ct_find_partner_candidate(text) from public;
revoke all on function public.ct_request_relationship(uuid,text) from public;
revoke all on function public.ct_respond_relationship(uuid,boolean) from public;
revoke all on function public.ct_end_relationship(uuid) from public;
grant execute on function public.ct_find_partner_candidate(text) to authenticated;
grant execute on function public.ct_request_relationship(uuid,text) to authenticated;
grant execute on function public.ct_respond_relationship(uuid,boolean) to authenticated;
grant execute on function public.ct_end_relationship(uuid) to authenticated;
commit;
