create or replace function public.reject_active_session_routine_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.workout_sessions ws
    where ws.user_id = auth.uid() and ws.status = 'ACTIVE' and ws.deleted_at is null
  ) and (
    new.name is distinct from old.name
    or new.weekly_frequency_target is distinct from old.weekly_frequency_target
    or new.is_active is distinct from old.is_active
    or new.archived_at is distinct from old.archived_at
  ) then
    raise exception using errcode = '23514', message = 'active_session_blocks_routine_change';
  end if;
  return new;
end;
$$;

create or replace function public.reject_active_session_routine_day_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_routine_id uuid := coalesce(new.routine_id, old.routine_id);
begin
  if exists (
    select 1
    from public.routines r
    join public.workout_sessions ws on ws.user_id = r.user_id
    where r.id = v_routine_id and r.is_active and ws.status = 'ACTIVE' and ws.deleted_at is null and ws.user_id = auth.uid()
  ) then
    raise exception using errcode = '23514', message = 'active_session_blocks_routine_change';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists active_session_routine_change_guard on public.routines;
create trigger active_session_routine_change_guard
before update of name, weekly_frequency_target, is_active, archived_at on public.routines
for each row execute function public.reject_active_session_routine_change();

drop trigger if exists active_session_routine_day_change_guard on public.routine_days;
create trigger active_session_routine_day_change_guard
before insert or update or delete on public.routine_days
for each row execute function public.reject_active_session_routine_day_change();

revoke all on function public.reject_active_session_routine_change() from public, authenticated;
revoke all on function public.reject_active_session_routine_day_change() from public, authenticated;
