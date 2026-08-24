-- CertiTrack Phase 59
-- Reliable notification read state through security-definer RPCs.

create or replace function public.ct_set_notification_read(
  p_notification uuid,
  p_read boolean default true
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.notifications
     set read_at=case when p_read then now() else null end
   where id=p_notification
     and user_id=auth.uid();
end;
$$;

revoke all on function public.ct_set_notification_read(uuid,boolean) from public;
grant execute on function public.ct_set_notification_read(uuid,boolean) to authenticated;


create or replace function public.ct_mark_notifications_read(
  p_notifications uuid[]
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  affected integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.notifications
     set read_at=coalesce(read_at,now())
   where user_id=auth.uid()
     and id=any(coalesce(p_notifications,'{}'::uuid[]));

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.ct_mark_notifications_read(uuid[]) from public;
grant execute on function public.ct_mark_notifications_read(uuid[]) to authenticated;
