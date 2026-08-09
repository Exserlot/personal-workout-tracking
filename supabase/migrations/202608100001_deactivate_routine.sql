create or replace function public.planning_deactivate_routine(
  p_id uuid,
  p_expected_revision integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_revision integer;
  v_is_active boolean;
begin
  select revision, is_active
  into v_revision, v_is_active
  from public.routines
  where id = p_id
    and user_id = auth.uid()
    and archived_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'routine_not_found';
  end if;
  if v_revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'revision_conflict';
  end if;
  if not v_is_active then
    raise exception using errcode = '23514', message = 'routine_not_active';
  end if;

  update public.routines
  set is_active = false,
      revision = revision + 1,
      updated_at = now()
  where id = p_id;

  return p_id;
end;
$$;

revoke all on function public.planning_deactivate_routine(uuid, integer) from public;
grant execute on function public.planning_deactivate_routine(uuid, integer) to authenticated;
