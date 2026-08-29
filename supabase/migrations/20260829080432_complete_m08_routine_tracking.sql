-- Complete M-08 rollout by backfilling the legacy active Routine on first use,
-- preserving one-release compatibility for the main branch, and exposing the
-- active Routine Day in provisional weekly history.

create or replace function public.routine_backfill_legacy_activation(p_detected_timezone text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_current_week date;
  v_active_routine_id uuid;
  v_routine public.routines%rowtype;
  v_days jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  perform public.routine_assert_timezone(p_detected_timezone);

  insert into public.user_preferences(user_id, timezone)
  values (v_user_id, p_detected_timezone)
  on conflict (user_id) do nothing;

  select timezone into v_timezone
  from public.user_preferences
  where user_id = v_user_id;

  -- Earlier RPCs could have created a UTC fallback before the browser supplied
  -- its timezone. It is safe to adopt the detected timezone while no weekly
  -- history or activation snapshot exists yet.
  if v_timezone = 'UTC' and p_detected_timezone <> 'UTC'
    and not exists (select 1 from public.routine_activation_events where user_id = v_user_id)
    and not exists (select 1 from public.routine_week_plans where user_id = v_user_id)
  then
    update public.user_preferences
    set timezone = p_detected_timezone, updated_at = now()
    where user_id = v_user_id;
    v_timezone := p_detected_timezone;
  end if;

  if not exists (select 1 from public.routine_activation_events where user_id = v_user_id) then
    select * into v_routine
    from public.routines
    where user_id = v_user_id and is_active and archived_at is null
    order by updated_at desc, id
    limit 1;

    if found then
      v_days := public.routine_days_snapshot(v_routine.id);
      if jsonb_array_length(v_days) between 1 and 7 then
        v_current_week := public.routine_week_start(now(), v_timezone);
        insert into public.routine_activation_events(
          user_id, routine_id, effective_week_start, timezone_snapshot,
          routine_revision_snapshot, routine_name_snapshot,
          frequency_target_snapshot, days_snapshot
        ) values (
          v_user_id, v_routine.id, v_current_week, v_timezone,
          v_routine.revision, v_routine.name,
          v_routine.weekly_frequency_target, v_days
        ) on conflict (user_id, effective_week_start) do nothing;
      end if;
    end if;
  end if;

  -- Keep the additive legacy columns aligned so the previous main-branch
  -- client remains a safe rollback target. This also realizes a scheduled
  -- activation after its week arrives as soon as either client initializes.
  v_current_week := public.routine_week_start(now(), v_timezone);
  select routine_id into v_active_routine_id
  from public.routine_activation_events
  where user_id = v_user_id and effective_week_start <= v_current_week
  order by effective_week_start desc, created_at desc
  limit 1;

  if found then
    update public.routines
    set
      is_active = (v_active_routine_id is not null and id = v_active_routine_id),
      next_workout_index = case
        when v_active_routine_id is not null and id = v_active_routine_id and not is_active then 0
        else next_workout_index
      end,
      updated_at = now()
    where user_id = v_user_id
      and is_active is distinct from (v_active_routine_id is not null and id = v_active_routine_id);
  end if;

  return v_timezone;
end;
$$;

create or replace function public.preferences_get_or_create_timezone(p_detected_timezone text default 'UTC')
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.routine_backfill_legacy_activation(p_detected_timezone);
end;
$$;

-- Backfill users whose timezone was already known. Users without a preference
-- are backfilled atomically on their first authenticated app load above.
insert into public.routine_activation_events(
  user_id, routine_id, effective_week_start, timezone_snapshot,
  routine_revision_snapshot, routine_name_snapshot,
  frequency_target_snapshot, days_snapshot
)
select
  r.user_id,
  r.id,
  public.routine_week_start(now(), p.timezone),
  p.timezone,
  r.revision,
  r.name,
  r.weekly_frequency_target,
  snapshot.days
from public.routines r
join public.user_preferences p on p.user_id = r.user_id
cross join lateral (select public.routine_days_snapshot(r.id) as days) snapshot
where r.is_active
  and r.archived_at is null
  and jsonb_array_length(snapshot.days) between 1 and 7
  and not exists (
    select 1 from public.routine_activation_events e where e.user_id = r.user_id
  )
on conflict (user_id, effective_week_start) do nothing;

create or replace function public.routine_week_to_json(p_week_plan_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'routine_id', p.routine_id,
    'routine_name', p.routine_name_snapshot,
    'routine_revision', p.routine_revision_snapshot,
    'week_start', p.week_start,
    'week_end', p.week_end,
    'timezone', p.timezone_snapshot,
    'frequency_actual', p.frequency_actual,
    'frequency_target', p.frequency_target_snapshot,
    'coverage_actual', p.coverage_actual,
    'coverage_target', p.day_count_snapshot,
    'status', p.status,
    'locked_at', p.locked_at,
    'finalized_at', p.finalized_at,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'routine_day_id', d.source_routine_day_id,
        'template_id', d.source_template_id,
        'display_order', d.display_order,
        'day_label', d.day_label_snapshot,
        'template_name', d.template_name_snapshot,
        'completed_count', (select count(*) from public.workout_sessions s
          where s.source_routine_week_plan_day_id = d.id
            and s.status = 'COMPLETED' and s.deleted_at is null),
        'active_count', (select count(*) from public.workout_sessions s
          where s.source_routine_week_plan_day_id = d.id
            and s.status = 'ACTIVE' and s.deleted_at is null)
      ) order by d.display_order)
      from public.routine_week_plan_days d where d.week_plan_id = p.id
    ), '[]'::jsonb)
  )
  from public.routine_week_plans p
  where p.id = p_week_plan_id and p.user_id = auth.uid()
$$;

-- Keep the legacy fixed-sequence client functional during the additive rollout.
-- New weekly Sessions never touch next_workout_index.
create or replace function public.workout_finish_session(
  p_session_id uuid,
  p_device_id uuid,
  p_expected_version integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.workout_sessions%rowtype;
  v_routine public.routines%rowtype;
  v_day_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  perform public.workout_assert_device(p_device_id);
  select * into v_session from public.workout_sessions where id = p_session_id for update;
  if not found or v_session.user_id <> auth.uid() then raise exception using errcode = 'P0002', message = 'session_not_found'; end if;
  if v_session.status = 'COMPLETED' then return p_session_id; end if;
  if v_session.status <> 'ACTIVE' then raise exception using errcode = 'P0001', message = 'session_not_active'; end if;
  if v_session.owner_device_id <> p_device_id then raise exception using errcode = 'P0001', message = 'device_locked'; end if;
  if v_session.version <> p_expected_version then raise exception using errcode = '40001', message = 'revision_conflict'; end if;

  update public.workout_sessions
  set status = 'COMPLETED', completed_at = now(), version = version + 1,
      edited_at = now(), updated_at = now()
  where id = p_session_id;

  if v_session.source_type = 'PLANNED' and v_session.source_routine_week_plan_id is null then
    select * into v_routine
    from public.routines
    where id = v_session.source_routine_id
      and user_id = auth.uid()
      and is_active
      and archived_at is null
    for update;
    if not found then raise exception using errcode = '40001', message = 'active_routine_changed'; end if;
    select count(*) into v_day_count from public.routine_days where routine_id = v_routine.id;
    update public.routines
    set next_workout_index = case when v_day_count < 1 then 0 else (v_routine.next_workout_index + 1) % v_day_count end,
        revision = revision + 1,
        updated_at = now()
    where id = v_routine.id;
  end if;

  perform public.routine_reconcile_weeks();
  return p_session_id;
end;
$$;

-- The legacy activation overloads now mirror their action into the weekly
-- activation model, so old and new clients do not create independent state.
create or replace function public.planning_activate_routine(p_id uuid, p_expected_revision integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_current_week date;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  perform public.routine_backfill_legacy_activation('UTC');
  select timezone into v_timezone from public.user_preferences where user_id = v_user_id;
  v_current_week := public.routine_week_start(now(), coalesce(v_timezone, 'UTC'));
  perform public.routine_upsert_activation_event(p_id, p_expected_revision, v_current_week);

  update public.routines
  set is_active = false, updated_at = now()
  where user_id = v_user_id and is_active and id <> p_id;
  update public.routines
  set is_active = true, next_workout_index = 0, revision = revision + 1, updated_at = now()
  where id = p_id and user_id = v_user_id;

  delete from public.routine_week_plans
  where user_id = v_user_id and week_start = v_current_week and locked_at is null;
  perform public.routine_reconcile_weeks();
  return p_id;
end;
$$;

create or replace function public.planning_deactivate_routine(p_id uuid, p_expected_revision integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_routine public.routines%rowtype;
  v_timezone text;
  v_current_week date;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select * into v_routine from public.routines
  where id = p_id and user_id = v_user_id and archived_at is null for update;
  if not found then raise exception using errcode = 'P0002', message = 'routine_not_found'; end if;
  if v_routine.revision <> p_expected_revision then raise exception using errcode = '40001', message = 'revision_conflict'; end if;
  if not v_routine.is_active then raise exception using errcode = '23514', message = 'routine_not_active'; end if;

  select timezone into v_timezone from public.user_preferences where user_id = v_user_id;
  v_timezone := coalesce(v_timezone, 'UTC');
  insert into public.user_preferences(user_id, timezone) values (v_user_id, v_timezone) on conflict do nothing;
  v_current_week := public.routine_week_start(now(), v_timezone);
  insert into public.routine_activation_events(user_id, routine_id, effective_week_start, timezone_snapshot)
  values (v_user_id, null, v_current_week, v_timezone)
  on conflict (user_id, effective_week_start) do update set
    routine_id = null,
    timezone_snapshot = excluded.timezone_snapshot,
    routine_revision_snapshot = null,
    routine_name_snapshot = null,
    frequency_target_snapshot = null,
    days_snapshot = null,
    updated_at = now();

  update public.routines
  set is_active = false, revision = revision + 1, updated_at = now()
  where id = p_id;
  delete from public.routine_week_plans
  where user_id = v_user_id and week_start = v_current_week and locked_at is null;
  return p_id;
end;
$$;

-- A Template is protected only when it participates in the effective or
-- scheduled Active Routine. Inactive draft Routines do not block archive.
create or replace function public.planning_archive_template(p_id uuid, p_expected_revision integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_current_week date;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select timezone into v_timezone from public.user_preferences where user_id = v_user_id;
  v_current_week := public.routine_week_start(now(), coalesce(v_timezone, 'UTC'));

  if exists (
    select 1
    from public.routine_activation_events e
    cross join lateral jsonb_array_elements(coalesce(e.days_snapshot, '[]'::jsonb)) d
    where e.user_id = v_user_id
      and e.routine_id is not null
      and (d->>'template_id')::uuid = p_id
      and (
        e.effective_week_start >= v_current_week
        or e.id = (
          select current_event.id
          from public.routine_activation_events current_event
          where current_event.user_id = v_user_id
            and current_event.effective_week_start <= v_current_week
          order by current_event.effective_week_start desc
          limit 1
        )
      )
  ) or (
    not exists (select 1 from public.routine_activation_events where user_id = v_user_id)
    and exists (
      select 1
      from public.routine_days rd
      join public.routines r on r.id = rd.routine_id
      where rd.template_id = p_id
        and r.user_id = v_user_id
        and r.is_active
        and r.archived_at is null
    )
  ) then
    raise exception using errcode = '23503', message = 'template_referenced_by_active_routine';
  end if;

  update public.workout_templates
  set archived_at = now(), revision = revision + 1, updated_at = now()
  where id = p_id and user_id = v_user_id and archived_at is null and revision = p_expected_revision;
  if not found then
    if exists (select 1 from public.workout_templates where id = p_id and user_id = v_user_id) then
      raise exception using errcode = '40001', message = 'revision_conflict';
    end if;
    raise exception using errcode = 'P0002', message = 'template_not_found';
  end if;
end;
$$;

revoke all on function public.routine_backfill_legacy_activation(text) from public, anon, authenticated;
revoke all on function public.preferences_get_or_create_timezone(text) from public, anon;
revoke all on function public.routine_week_to_json(uuid) from public, anon, authenticated;
revoke all on function public.workout_finish_session(uuid, uuid, integer) from public, anon;
revoke all on function public.planning_activate_routine(uuid, integer) from public, anon;
revoke all on function public.planning_deactivate_routine(uuid, integer) from public, anon;
revoke all on function public.planning_archive_template(uuid, integer) from public, anon;

grant execute on function public.preferences_get_or_create_timezone(text) to authenticated;
grant execute on function public.workout_finish_session(uuid, uuid, integer) to authenticated;
grant execute on function public.planning_activate_routine(uuid, integer) to authenticated;
grant execute on function public.planning_deactivate_routine(uuid, integer) to authenticated;
grant execute on function public.planning_archive_template(uuid, integer) to authenticated;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
  if to_regprocedure('public.touch_progress_source_state()') is not null then
    execute 'revoke all on function public.touch_progress_source_state() from public, anon, authenticated';
  end if;
end;
$$;
