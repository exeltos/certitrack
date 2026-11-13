-- Deleting an organization cascades to its certificates, members, connections…
-- Their audit rows were written with the organization's id, which no longer
-- exists at that point, so the foreign key rejected the whole delete. Audit
-- rows of a deleted organization are now kept without the organization link.
create or replace function public.ct_audit_row_change()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_orgs uuid[];
  v_org uuid;
begin
  v_orgs := case tg_table_name
    when 'organizations' then array[(v_row->>'id')::uuid]
    when 'connections' then array[(v_row->>'requester_org_id')::uuid, (v_row->>'addressee_org_id')::uuid]
    when 'document_requests' then array[(v_row->>'requester_org_id')::uuid, (v_row->>'responder_org_id')::uuid]
    when 'certificate_shares' then array[(select organization_id from public.certificates
                                          where id = (v_row->>'certificate_id')::uuid)]
    else array[(v_row->>'organization_id')::uuid]
  end;
  foreach v_org in array v_orgs loop
    if v_org is not null and not exists(select 1 from public.organizations where id = v_org) then
      v_org := null;
    end if;
    insert into public.audit_log(organization_id, actor_user_id, action, entity_type, entity_id, old_data, new_data)
    values (v_org, auth.uid(), lower(tg_op), tg_table_name,
            coalesce(v_row->>'id', v_row->>'certificate_id'),
            case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
            case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  end loop;
  return null;
end;
$$;
