-- M-08: flexible Monday-Sunday routine tracking.
-- Legacy routines.is_active / routines.next_workout_index / routine_days.sequence_no
-- remain for one compatibility release, but none of the contracts below use them
-- as progression state.

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.routine_activation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid references public.routines(id) on delete restrict,
  effective_week_start date not null,
  timezone_snapshot text not null,
  routine_revision_snapshot integer,
  routine_name_snapshot varchar(160),
  frequency_target_snapshot integer,
  days_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, effective_week_start),
  constraint routine_activation_snapshot_complete check (
    (routine_id is null and routine_revision_snapshot is null and routine_name_snapshot is null
      and frequency_target_snapshot is null and days_snapshot is null)
    or
    (routine_id is not null and routine_revision_snapshot >= 1
      and char_length(btrim(routine_name_snapshot)) between 1 and 160
      and frequency_target_snapshot between 1 and 7
      and jsonb_typeof(days_snapshot) = 'array'
      and jsonb_array_length(days_snapshot) between 1 and 7)
  )
);

create table public.routine_week_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activation_event_id uuid not null references public.routine_activation_events(id) on delete restrict,
  routine_id uuid not null references public.routines(id) on delete restrict,
  week_start date not null,
  week_end date generated always as (week_start + 6) stored,
  timezone_snapshot text not null,
  routine_revision_snapshot integer not null check (routine_revision_snapshot >= 1),
  routine_name_snapshot varchar(160) not null,
  frequency_target_snapshot integer not null check (frequency_target_snapshot between 1 and 7),
  day_count_snapshot integer not null check (day_count_snapshot between 1 and 7),
  frequency_actual integer not null default 0 check (frequency_actual >= 0),
  coverage_actual integer not null default 0 check (coverage_actual >= 0),
  status text not null default 'OPEN' check (status in ('OPEN', 'PROVISIONAL', 'FINALIZED')),
  locked_at timestamptz,
  finalized_at timestamptz,
  notification_decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start),
  check (coverage_actual <= day_count_snapshot),
  check ((status = 'FINALIZED') = (finalized_at is not null))
);

create table public.routine_week_plan_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_plan_id uuid not null references public.routine_week_plans(id) on delete cascade,
  source_routine_day_id uuid not null,
  source_template_id uuid references public.workout_templates(id) on delete set null,
  display_order integer not null check (display_order between 1 and 7),
  day_label_snapshot varchar(80) not null,
  template_name_snapshot varchar(160) not null,
  created_at timestamptz not null default now(),
  unique (week_plan_id, source_routine_day_id),
  unique (week_plan_id, display_order)
);

create table public.weekly_routine_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_plan_id uuid not null references public.routine_week_plans(id) on delete cascade,
  title_snapshot varchar(200) not null,
  content_snapshot text not null check (char_length(content_snapshot) between 1 and 2000),
  frequency_actual_snapshot integer not null check (frequency_actual_snapshot >= 0),
  frequency_target_snapshot integer not null check (frequency_target_snapshot between 1 and 7),
  coverage_actual_snapshot integer not null check (coverage_actual_snapshot >= 0),
  coverage_target_snapshot integer not null check (coverage_target_snapshot between 1 and 7),
  missing_day_labels_snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(missing_day_labels_snapshot) = 'array'),
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (week_plan_id)
);

alter table public.workout_sessions
  add column source_routine_week_plan_id uuid references public.routine_week_plans(id) on delete set null,
  add column source_routine_week_plan_day_id uuid references public.routine_week_plan_days(id) on delete set null;

-- Weekly snapshots make definition edits safe while a Session is active. The
-- current week remains locked; planning_update_routine schedules those edits for
-- the following week instead of rejecting them globally.
drop trigger if exists active_session_routine_change_guard on public.routines;
drop trigger if exists active_session_routine_day_change_guard on public.routine_days;

do $$
declare v_constraint text;
begin
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'public.workout_sessions'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%source_type%PLANNED%source_routine_day_id%';
  if v_constraint is not null then
    execute format('alter table public.workout_sessions drop constraint %I', v_constraint);
  end if;
end;
$$;
alter table public.workout_sessions add constraint workout_sessions_planned_source_snapshot_check
  check (source_type <> 'PLANNED' or (source_template_id is not null and template_name_snapshot is not null));

create index routine_activation_events_user_effective_idx
  on public.routine_activation_events(user_id, effective_week_start desc);
create index routine_activation_events_routine_idx
  on public.routine_activation_events(routine_id) where routine_id is not null;
create index routine_week_plans_user_week_idx
  on public.routine_week_plans(user_id, week_start desc);
create index routine_week_plans_activation_idx
  on public.routine_week_plans(activation_event_id);
create index routine_week_plans_routine_idx
  on public.routine_week_plans(routine_id);
create index routine_week_plan_days_user_idx
  on public.routine_week_plan_days(user_id);
create index routine_week_plan_days_template_idx
  on public.routine_week_plan_days(source_template_id) where source_template_id is not null;
create index weekly_routine_notifications_user_created_idx
  on public.weekly_routine_notifications(user_id, created_at desc);
create index workout_sessions_week_plan_idx
  on public.workout_sessions(source_routine_week_plan_id)
  where source_routine_week_plan_id is not null;
create index workout_sessions_week_plan_day_idx
  on public.workout_sessions(source_routine_week_plan_day_id)
  where source_routine_week_plan_day_id is not null;

alter table public.user_preferences enable row level security;
alter table public.routine_activation_events enable row level security;
alter table public.routine_week_plans enable row level security;
alter table public.routine_week_plan_days enable row level security;
alter table public.weekly_routine_notifications enable row level security;

create policy "owners read user preferences" on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "owners read activation events" on public.routine_activation_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "owners read routine week plans" on public.routine_week_plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "owners read routine week days" on public.routine_week_plan_days
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "owners read weekly notifications" on public.weekly_routine_notifications
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.user_preferences from anon, authenticated;
revoke all on table public.routine_activation_events from anon, authenticated;
revoke all on table public.routine_week_plans from anon, authenticated;
revoke all on table public.routine_week_plan_days from anon, authenticated;
revoke all on table public.weekly_routine_notifications from anon, authenticated;
grant select on table public.user_preferences to authenticated;
grant select on table public.routine_activation_events to authenticated;
grant select on table public.routine_week_plans to authenticated;
grant select on table public.routine_week_plan_days to authenticated;
grant select on table public.weekly_routine_notifications to authenticated;

create or replace function public.routine_week_start(p_at timestamptz, p_timezone text)
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select (p_at at time zone p_timezone)::date
    - (extract(isodow from (p_at at time zone p_timezone))::integer - 1)
$$;

create or replace function public.routine_assert_timezone(p_timezone text)
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_timezone is null or not exists (
    select 1 from pg_timezone_names where name = p_timezone
  ) then
    raise exception using errcode = '22023', message = 'invalid_timezone';
  end if;
  return p_timezone;
end;
$$;

create or replace function public.routine_validate_timezone_trigger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.routine_assert_timezone(to_jsonb(new)->>tg_argv[0]);
  return new;
end;
$$;

create trigger user_preferences_validate_timezone
before insert or update of timezone on public.user_preferences
for each row execute function public.routine_validate_timezone_trigger('timezone');

create trigger routine_activation_events_validate_timezone
before insert or update of timezone_snapshot on public.routine_activation_events
for each row execute function public.routine_validate_timezone_trigger('timezone_snapshot');

create trigger routine_week_plans_validate_timezone
before insert or update of timezone_snapshot on public.routine_week_plans
for each row execute function public.routine_validate_timezone_trigger('timezone_snapshot');

create or replace function public.preferences_get_or_create_timezone(p_detected_timezone text default 'UTC')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  perform public.routine_assert_timezone(p_detected_timezone);
  insert into public.user_preferences(user_id, timezone)
  values (v_user_id, p_detected_timezone)
  on conflict (user_id) do nothing;
  select timezone into v_timezone from public.user_preferences where user_id = v_user_id;
  return v_timezone;
end;
$$;

create or replace function public.preferences_update_timezone(p_timezone text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_old_timezone text;
  v_current_week date;
  v_next_event public.routine_activation_events%rowtype;
  v_active_event public.routine_activation_events%rowtype;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  perform public.routine_assert_timezone(p_timezone);
  perform public.routine_reconcile_weeks();
  select timezone into v_old_timezone from public.user_preferences where user_id = v_user_id;
  v_old_timezone := coalesce(v_old_timezone, 'UTC');
  v_current_week := public.routine_week_start(now(), v_old_timezone);
  insert into public.user_preferences(user_id, timezone, updated_at)
  values (v_user_id, p_timezone, now())
  on conflict (user_id) do update set timezone = excluded.timezone, updated_at = now();
  select * into v_next_event from public.routine_activation_events
  where user_id = v_user_id and effective_week_start = v_current_week + 7;
  if found then
    update public.routine_activation_events set timezone_snapshot = p_timezone, updated_at = now()
    where id = v_next_event.id;
  else
    select * into v_active_event from public.routine_activation_events
    where user_id = v_user_id and effective_week_start <= v_current_week
    order by effective_week_start desc limit 1;
    if found then
      insert into public.routine_activation_events(
        user_id, routine_id, effective_week_start, timezone_snapshot,
        routine_revision_snapshot, routine_name_snapshot,
        frequency_target_snapshot, days_snapshot
      ) values (
        v_user_id, v_active_event.routine_id, v_current_week + 7, p_timezone,
        v_active_event.routine_revision_snapshot, v_active_event.routine_name_snapshot,
        v_active_event.frequency_target_snapshot, v_active_event.days_snapshot
      );
    end if;
  end if;
  return p_timezone;
end;
$$;

create or replace function public.routine_days_snapshot(p_routine_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'routine_day_id', rd.id,
    'template_id', rd.template_id,
    'display_order', rd.sequence_no,
    'day_label', coalesce(nullif(btrim(rd.label), ''), wt.name),
    'template_name', wt.name
  ) order by rd.sequence_no), '[]'::jsonb)
  from public.routine_days rd
  join public.workout_templates wt on wt.id = rd.template_id
  where rd.routine_id = p_routine_id
$$;

create or replace function public.routine_upsert_activation_event(
  p_routine_id uuid,
  p_expected_revision integer,
  p_effective_week_start date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_routine public.routines%rowtype;
  v_timezone text;
  v_days jsonb;
  v_event_id uuid;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select * into v_routine from public.routines
  where id = p_routine_id and user_id = v_user_id and archived_at is null for update;
  if not found then raise exception using errcode = 'P0002', message = 'routine_not_found'; end if;
  if v_routine.revision <> p_expected_revision then raise exception using errcode = '40001', message = 'revision_conflict'; end if;
  v_days := public.routine_days_snapshot(p_routine_id);
  if jsonb_array_length(v_days) not between 1 and 7 then
    raise exception using errcode = '23514', message = 'routine_requires_day';
  end if;
  select timezone into v_timezone from public.user_preferences where user_id = v_user_id;
  if v_timezone is null then
    insert into public.user_preferences(user_id, timezone) values (v_user_id, 'UTC') on conflict do nothing;
    v_timezone := 'UTC';
  end if;
  insert into public.routine_activation_events(
    user_id, routine_id, effective_week_start, timezone_snapshot,
    routine_revision_snapshot, routine_name_snapshot, frequency_target_snapshot, days_snapshot
  ) values (
    v_user_id, p_routine_id, p_effective_week_start, v_timezone,
    v_routine.revision, v_routine.name, v_routine.weekly_frequency_target, v_days
  )
  on conflict (user_id, effective_week_start) do update set
    routine_id = excluded.routine_id,
    timezone_snapshot = excluded.timezone_snapshot,
    routine_revision_snapshot = excluded.routine_revision_snapshot,
    routine_name_snapshot = excluded.routine_name_snapshot,
    frequency_target_snapshot = excluded.frequency_target_snapshot,
    days_snapshot = excluded.days_snapshot,
    updated_at = now()
  returning id into v_event_id;
  return v_event_id;
end;
$$;

create or replace function public.routine_reconcile_weeks()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_current_week date;
  v_first_week date;
  v_week date;
  v_event public.routine_activation_events%rowtype;
  v_plan public.routine_week_plans%rowtype;
  v_day jsonb;
  v_frequency integer;
  v_coverage integer;
  v_has_active boolean;
  v_missing jsonb;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select timezone into v_timezone from public.user_preferences where user_id = v_user_id;
  if v_timezone is null then
    insert into public.user_preferences(user_id, timezone) values (v_user_id, 'UTC') on conflict do nothing;
    v_timezone := 'UTC';
  end if;
  v_current_week := public.routine_week_start(now(), v_timezone);
  select min(effective_week_start) into v_first_week
  from public.routine_activation_events where user_id = v_user_id;
  if v_first_week is null then return; end if;

  for v_week in select generate_series(v_first_week, v_current_week, interval '7 days')::date loop
    select * into v_event
    from public.routine_activation_events
    where user_id = v_user_id and effective_week_start <= v_week
    order by effective_week_start desc limit 1;
    if v_event.routine_id is null then continue; end if;

    insert into public.routine_week_plans(
      user_id, activation_event_id, routine_id, week_start, timezone_snapshot,
      routine_revision_snapshot, routine_name_snapshot, frequency_target_snapshot, day_count_snapshot
    ) values (
      v_user_id, v_event.id, v_event.routine_id, v_week, v_event.timezone_snapshot,
      v_event.routine_revision_snapshot, v_event.routine_name_snapshot,
      v_event.frequency_target_snapshot, jsonb_array_length(v_event.days_snapshot)
    ) on conflict (user_id, week_start) do nothing;

    select * into v_plan from public.routine_week_plans
    where user_id = v_user_id and week_start = v_week for update;
    if not exists (select 1 from public.routine_week_plan_days where week_plan_id = v_plan.id) then
      for v_day in select value from jsonb_array_elements(v_event.days_snapshot) loop
        insert into public.routine_week_plan_days(
          user_id, week_plan_id, source_routine_day_id, source_template_id,
          display_order, day_label_snapshot, template_name_snapshot
        ) values (
          v_user_id, v_plan.id, (v_day->>'routine_day_id')::uuid,
          (v_day->>'template_id')::uuid, (v_day->>'display_order')::integer,
          v_day->>'day_label', v_day->>'template_name'
        );
      end loop;
    end if;

    select count(*), count(distinct source_routine_week_plan_day_id)
    into v_frequency, v_coverage
    from public.workout_sessions
    where user_id = v_user_id
      and source_type = 'PLANNED'
      and source_routine_week_plan_id = v_plan.id
      and status = 'COMPLETED'
      and deleted_at is null;
    select exists (
      select 1 from public.workout_sessions
      where user_id = v_user_id and source_routine_week_plan_id = v_plan.id
        and status = 'ACTIVE' and deleted_at is null
    ) into v_has_active;

    update public.routine_week_plans set
      frequency_actual = v_frequency,
      coverage_actual = v_coverage,
      status = case
        when v_week < v_current_week and v_has_active then 'PROVISIONAL'
        when v_week < v_current_week then 'FINALIZED'
        else 'OPEN'
      end,
      finalized_at = case
        when v_week < v_current_week and not v_has_active then coalesce(finalized_at, now())
        else null
      end,
      updated_at = now()
    where id = v_plan.id;

    if v_week < v_current_week and not v_has_active and v_plan.notification_decided_at is null then
      select coalesce(jsonb_agg(day_label_snapshot order by display_order), '[]'::jsonb)
      into v_missing
      from public.routine_week_plan_days d
      where d.week_plan_id = v_plan.id and not exists (
        select 1 from public.workout_sessions s
        where s.source_routine_week_plan_day_id = d.id
          and s.status = 'COMPLETED' and s.deleted_at is null
      );
      if v_frequency < v_plan.frequency_target_snapshot or v_coverage < v_plan.day_count_snapshot then
        insert into public.weekly_routine_notifications(
          user_id, week_plan_id, title_snapshot, content_snapshot,
          frequency_actual_snapshot, frequency_target_snapshot,
          coverage_actual_snapshot, coverage_target_snapshot, missing_day_labels_snapshot
        ) values (
          v_user_id, v_plan.id, 'Routine สัปดาห์ที่แล้วไม่ครบ',
          case
            when jsonb_array_length(v_missing) > 0 then 'คุณยังไม่ได้เล่น ' || array_to_string(array(select jsonb_array_elements_text(v_missing)), ', ')
            else 'คุณทำจำนวน Session ไม่ครบเป้าหมายประจำสัปดาห์'
          end,
          v_frequency, v_plan.frequency_target_snapshot,
          v_coverage, v_plan.day_count_snapshot, v_missing
        ) on conflict (week_plan_id) do nothing;
      end if;
      update public.routine_week_plans set notification_decided_at = now() where id = v_plan.id;
    end if;
  end loop;
end;
$$;

create or replace function public.planning_activate_routine(
  p_id uuid,
  p_expected_revision integer,
  p_effective_week_start date
)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_current_week date;
  v_locked boolean;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select timezone into v_timezone from public.user_preferences where user_id = v_user_id;
  if v_timezone is null then v_timezone := 'UTC'; end if;
  v_current_week := public.routine_week_start(now(), v_timezone);
  if p_effective_week_start not in (v_current_week, v_current_week + 7) then
    raise exception using errcode = '22023', message = 'invalid_effective_week';
  end if;
  perform public.routine_reconcile_weeks();
  select locked_at is not null into v_locked from public.routine_week_plans
  where user_id = v_user_id and week_start = v_current_week;
  if p_effective_week_start = v_current_week and coalesce(v_locked, false) then
    raise exception using errcode = 'P0001', message = 'routine_week_locked';
  end if;
  perform public.routine_upsert_activation_event(p_id, p_expected_revision, p_effective_week_start);
  if p_effective_week_start = v_current_week then
    delete from public.routine_week_plans where user_id = v_user_id and week_start = v_current_week and locked_at is null;
    perform public.routine_reconcile_weeks();
  end if;
  return p_effective_week_start;
end;
$$;

create or replace function public.planning_deactivate_routine(p_effective_week_start date)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_current_week date;
  v_locked boolean;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select timezone into v_timezone from public.user_preferences where user_id = v_user_id;
  if v_timezone is null then v_timezone := 'UTC'; end if;
  v_current_week := public.routine_week_start(now(), v_timezone);
  if p_effective_week_start not in (v_current_week, v_current_week + 7) then
    raise exception using errcode = '22023', message = 'invalid_effective_week';
  end if;
  perform public.routine_reconcile_weeks();
  select locked_at is not null into v_locked from public.routine_week_plans
  where user_id = v_user_id and week_start = v_current_week;
  if p_effective_week_start = v_current_week and coalesce(v_locked, false) then
    raise exception using errcode = 'P0001', message = 'routine_week_locked';
  end if;
  insert into public.routine_activation_events(user_id, routine_id, effective_week_start, timezone_snapshot)
  values (v_user_id, null, p_effective_week_start, v_timezone)
  on conflict (user_id, effective_week_start) do update set
    routine_id = null, timezone_snapshot = excluded.timezone_snapshot,
    routine_revision_snapshot = null, routine_name_snapshot = null,
    frequency_target_snapshot = null, days_snapshot = null, updated_at = now();
  if p_effective_week_start = v_current_week then
    delete from public.routine_week_plans where user_id = v_user_id and week_start = v_current_week and locked_at is null;
  end if;
  return p_effective_week_start;
end;
$$;

-- Forward declaration so the current-week RPC can be created before the full
-- JSON projection below. It is replaced immediately afterward in this migration.
create or replace function public.routine_week_to_json(p_week_plan_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$ select null::jsonb $$;

create or replace function public.routine_get_current_week()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_current_week date;
  v_plan public.routine_week_plans%rowtype;
  v_scheduled public.routine_activation_events%rowtype;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  perform public.routine_reconcile_weeks();
  select timezone into v_timezone from public.user_preferences where user_id = v_user_id;
  v_timezone := coalesce(v_timezone, 'UTC');
  v_current_week := public.routine_week_start(now(), v_timezone);
  select * into v_plan from public.routine_week_plans
  where user_id = v_user_id and week_start = v_current_week;
  select * into v_scheduled from public.routine_activation_events
  where user_id = v_user_id and effective_week_start = v_current_week + 7;
  return jsonb_build_object(
    'timezone', v_timezone,
    'current_week_start', v_current_week,
    'next_week_start', v_current_week + 7,
    'current_plan', case when v_plan.id is null then null else public.routine_week_to_json(v_plan.id) end,
    'scheduled_activation', case when v_scheduled.id is null then null else jsonb_build_object(
      'routine_id', v_scheduled.routine_id,
      'routine_name', v_scheduled.routine_name_snapshot,
      'effective_week_start', v_scheduled.effective_week_start,
      'is_deactivation', v_scheduled.routine_id is null
    ) end
  );
end;
$$;

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
            and s.status = 'COMPLETED' and s.deleted_at is null)
      ) order by d.display_order)
      from public.routine_week_plan_days d where d.week_plan_id = p.id
    ), '[]'::jsonb)
  )
  from public.routine_week_plans p
  where p.id = p_week_plan_id and p.user_id = auth.uid()
$$;

create or replace function public.routine_list_history(p_limit integer default 52, p_offset integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  perform public.routine_reconcile_weeks();
  select coalesce(jsonb_agg(public.routine_week_to_json(q.id) order by q.week_start desc), '[]'::jsonb)
  into v_result
  from (
    select id, week_start from public.routine_week_plans
    where user_id = auth.uid()
    order by week_start desc limit greatest(1, least(coalesce(p_limit, 52), 104))
    offset greatest(coalesce(p_offset, 0), 0)
  ) q;
  return v_result;
end;
$$;

create or replace function public.routine_get_week(p_week_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  perform public.routine_reconcile_weeks();
  v_result := public.routine_week_to_json(p_week_plan_id);
  if v_result is null then raise exception using errcode = 'P0002', message = 'routine_week_not_found'; end if;
  return v_result;
end;
$$;

create or replace function public.routine_list_notifications()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  perform public.routine_reconcile_weeks();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id, 'week_plan_id', n.week_plan_id,
    'title', n.title_snapshot, 'content', n.content_snapshot,
    'frequency_actual', n.frequency_actual_snapshot,
    'frequency_target', n.frequency_target_snapshot,
    'coverage_actual', n.coverage_actual_snapshot,
    'coverage_target', n.coverage_target_snapshot,
    'missing_day_labels', n.missing_day_labels_snapshot,
    'read_at', n.read_at, 'dismissed_at', n.dismissed_at,
    'created_at', n.created_at, 'week_start', p.week_start, 'week_end', p.week_end
  ) order by n.created_at desc), '[]'::jsonb)
  into v_result
  from public.weekly_routine_notifications n
  join public.routine_week_plans p on p.id = n.week_plan_id
  where n.user_id = auth.uid() and n.dismissed_at is null;
  return v_result;
end;
$$;

create or replace function public.routine_mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  update public.weekly_routine_notifications set read_at = coalesce(read_at, now())
  where id = p_notification_id and user_id = auth.uid();
  if not found then raise exception using errcode = 'P0002', message = 'notification_not_found'; end if;
end;
$$;

create or replace function public.routine_dismiss_notification(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  update public.weekly_routine_notifications
  set read_at = coalesce(read_at, now()), dismissed_at = coalesce(dismissed_at, now())
  where id = p_notification_id and user_id = auth.uid();
  if not found then raise exception using errcode = 'P0002', message = 'notification_not_found'; end if;
end;
$$;

create or replace function public.routine_get_session_removal_impact(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.workout_sessions%rowtype;
  v_plan public.routine_week_plans%rowtype;
  v_frequency integer;
  v_coverage integer;
  v_missing jsonb;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  perform public.routine_reconcile_weeks();
  select * into v_session from public.workout_sessions
  where id = p_session_id and user_id = auth.uid() and status = 'COMPLETED' and deleted_at is null;
  if not found then raise exception using errcode = 'P0002', message = 'session_not_found'; end if;
  if v_session.source_routine_week_plan_id is null then
    return jsonb_build_object('affects_routine_week', false);
  end if;
  select * into v_plan from public.routine_week_plans where id = v_session.source_routine_week_plan_id;
  select count(*), count(distinct source_routine_week_plan_day_id)
  into v_frequency, v_coverage
  from public.workout_sessions
  where user_id = auth.uid() and source_routine_week_plan_id = v_plan.id
    and status = 'COMPLETED' and deleted_at is null and id <> p_session_id;
  select coalesce(jsonb_agg(d.day_label_snapshot order by d.display_order), '[]'::jsonb)
  into v_missing
  from public.routine_week_plan_days d
  where d.week_plan_id = v_plan.id and not exists (
    select 1 from public.workout_sessions s
    where s.source_routine_week_plan_day_id = d.id and s.id <> p_session_id
      and s.status = 'COMPLETED' and s.deleted_at is null
  );
  return jsonb_build_object(
    'affects_routine_week', true, 'week_plan_id', v_plan.id,
    'week_start', v_plan.week_start, 'week_end', v_plan.week_end,
    'frequency_after', v_frequency, 'frequency_target', v_plan.frequency_target_snapshot,
    'coverage_after', v_coverage, 'coverage_target', v_plan.day_count_snapshot,
    'missing_day_labels_after', v_missing
  );
end;
$$;

-- Replace the planned-session contract: the chosen week/day is explicit and the
-- first start locks only weekly membership/labels/target. Template content is
-- still copied at start using the current template revision.
create or replace function public.workout_start_planned(
  p_session_id uuid,
  p_device_id uuid,
  p_week_plan_id uuid,
  p_week_plan_day_id uuid,
  p_expected_template_revision integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.workout_sessions%rowtype;
  v_plan public.routine_week_plans%rowtype;
  v_day public.routine_week_plan_days%rowtype;
  v_template public.workout_templates%rowtype;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  perform public.workout_assert_device(p_device_id);
  perform public.routine_reconcile_weeks();
  select * into v_existing from public.workout_sessions where id = p_session_id and user_id = v_user_id;
  if found then
    if v_existing.status = 'ACTIVE' and v_existing.owner_device_id = p_device_id then return p_session_id; end if;
    raise exception using errcode = 'P0001', message = 'session_id_conflict';
  end if;
  if exists (select 1 from public.workout_sessions where user_id = v_user_id and status = 'ACTIVE' and deleted_at is null for update) then
    raise exception using errcode = '23505', message = 'active_session_exists';
  end if;
  select * into v_plan from public.routine_week_plans
  where id = p_week_plan_id and user_id = v_user_id for update;
  if not found or v_plan.status <> 'OPEN'
    or public.routine_week_start(now(), v_plan.timezone_snapshot) <> v_plan.week_start then
    raise exception using errcode = 'P0002', message = 'routine_week_not_available';
  end if;
  select * into v_day from public.routine_week_plan_days
  where id = p_week_plan_day_id and week_plan_id = v_plan.id and user_id = v_user_id;
  if not found then raise exception using errcode = 'P0002', message = 'routine_week_day_not_found'; end if;
  v_template := public.workout_assert_template_usable(v_day.source_template_id);
  if p_expected_template_revision is not null and v_template.revision <> p_expected_template_revision then
    raise exception using errcode = '40001', message = 'revision_conflict';
  end if;
  update public.routine_week_plans set locked_at = coalesce(locked_at, now()), updated_at = now() where id = v_plan.id;
  insert into public.workout_sessions(
    id, user_id, owner_device_id, source_type,
    source_routine_id, source_routine_day_id, source_template_id,
    source_routine_week_plan_id, source_routine_week_plan_day_id,
    source_routine_revision, source_template_revision,
    routine_name_snapshot, day_label_snapshot, template_name_snapshot
  ) values (
    p_session_id, v_user_id, p_device_id, 'PLANNED',
    v_plan.routine_id, v_day.source_routine_day_id, v_template.id,
    v_plan.id, v_day.id, v_plan.routine_revision_snapshot, v_template.revision,
    v_plan.routine_name_snapshot, v_day.day_label_snapshot, v_template.name
  );
  perform public.workout_copy_template_snapshot(p_session_id, v_template.id);
  return p_session_id;
end;
$$;

create or replace function public.workout_finish_session(p_session_id uuid, p_device_id uuid, p_expected_version integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_session public.workout_sessions%rowtype;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  perform public.workout_assert_device(p_device_id);
  select * into v_session from public.workout_sessions where id = p_session_id for update;
  if not found or v_session.user_id <> auth.uid() then raise exception using errcode = 'P0002', message = 'session_not_found'; end if;
  if v_session.status = 'COMPLETED' then return p_session_id; end if;
  if v_session.status <> 'ACTIVE' then raise exception using errcode = 'P0001', message = 'session_not_active'; end if;
  if v_session.owner_device_id <> p_device_id then raise exception using errcode = 'P0001', message = 'device_locked'; end if;
  if v_session.version <> p_expected_version then raise exception using errcode = '40001', message = 'revision_conflict'; end if;
  update public.workout_sessions set status = 'COMPLETED', completed_at = now(), version = version + 1, edited_at = now(), updated_at = now() where id = p_session_id;
  perform public.routine_reconcile_weeks();
  return p_session_id;
end;
$$;

create or replace function public.workout_discard_session(p_session_id uuid, p_device_id uuid, p_expected_version integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_session public.workout_sessions%rowtype;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  perform public.workout_assert_device(p_device_id);
  select * into v_session from public.workout_sessions where id = p_session_id for update;
  if not found or v_session.user_id <> auth.uid() then raise exception using errcode = 'P0002', message = 'session_not_found'; end if;
  if v_session.status = 'DISCARDED' then return p_session_id; end if;
  if v_session.status <> 'ACTIVE' then raise exception using errcode = 'P0001', message = 'session_not_active'; end if;
  if v_session.owner_device_id <> p_device_id then raise exception using errcode = 'P0001', message = 'device_locked'; end if;
  if v_session.version <> p_expected_version then raise exception using errcode = '40001', message = 'revision_conflict'; end if;
  update public.workout_sessions set status = 'DISCARDED', version = version + 1, edited_at = now(), updated_at = now() where id = p_session_id;
  perform public.routine_reconcile_weeks();
  return p_session_id;
end;
$$;

-- Preserve idempotent history deletion while immediately recalculating weekly
-- metrics. notification_decided_at prevents retrospective notification creation.
create or replace function public.history_soft_delete_session(
  p_operation_id uuid,
  p_session_id uuid,
  p_expected_version integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt public.mutation_receipts%rowtype;
  v_session public.workout_sessions%rowtype;
  v_hash text;
  v_version integer;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  if p_operation_id is null or p_session_id is null or p_expected_version < 1 then raise exception using errcode = '22023', message = 'invalid_history_delete_request'; end if;
  perform pg_advisory_xact_lock(hashtext(p_operation_id::text));
  v_hash := md5(concat_ws('|', p_session_id::text, p_expected_version::text, 'soft_delete'));
  select * into v_receipt from public.mutation_receipts where operation_id = p_operation_id;
  if found then
    if v_receipt.user_id <> auth.uid() or v_receipt.aggregate_id <> p_session_id or v_receipt.request_hash <> v_hash then raise exception using errcode = 'P0001', message = 'operation_id_conflict'; end if;
    return v_receipt.result_version;
  end if;
  select * into v_session from public.workout_sessions where id = p_session_id for update;
  if not found or v_session.user_id <> auth.uid() then raise exception using errcode = 'P0002', message = 'session_not_found'; end if;
  if v_session.status <> 'COMPLETED' or v_session.deleted_at is not null then raise exception using errcode = 'P0001', message = 'history_session_not_editable'; end if;
  if v_session.version <> p_expected_version then raise exception using errcode = '40001', message = 'revision_conflict'; end if;
  update public.workout_sessions set deleted_at = now(), edited_at = now(), version = version + 1, updated_at = now() where id = p_session_id;
  select version into v_version from public.workout_sessions where id = p_session_id;
  insert into public.mutation_receipts(operation_id, user_id, aggregate_type, aggregate_id, request_hash, result_version)
  values(p_operation_id, auth.uid(), 'WORKOUT_HISTORY', p_session_id, v_hash, v_version);
  perform public.routine_reconcile_weeks();
  return v_version;
end;
$$;

-- New routines may contain at most seven coverage identities. The legacy
-- sequence column remains display order only.
create or replace function public.planning_validate_routine_days(p_days jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare v_day jsonb; v_template_id uuid;
begin
  if jsonb_typeof(coalesce(p_days, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_days, '[]'::jsonb)) not between 1 and 7 then
    raise exception using errcode = '23514', message = 'routine_days_out_of_range';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_days) with ordinality rows(value, ordinal)
    where (value->>'sequence_no')::integer <> ordinal
  ) then raise exception using errcode = '23514', message = 'invalid_routine_sequence'; end if;
  for v_day in select value from jsonb_array_elements(p_days) loop
    v_template_id := (v_day->>'template_id')::uuid;
    if not exists (
      select 1 from public.workout_templates wt
      where wt.id = v_template_id and wt.user_id = auth.uid() and wt.archived_at is null
        and exists (select 1 from public.template_exercises te where te.template_id = wt.id)
        and not exists (
          select 1 from public.template_exercises te where te.template_id = wt.id
          and not exists (select 1 from public.template_set_prescriptions tsp where tsp.template_exercise_id = te.id)
        )
    ) then raise exception using errcode = '23514', message = 'routine_template_invalid'; end if;
  end loop;
end;
$$;

create or replace function public.planning_update_routine(
  p_id uuid,
  p_expected_revision integer,
  p_name text,
  p_weekly_frequency_target integer,
  p_days jsonb
)
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
  v_effective_week date;
  v_active_event public.routine_activation_events%rowtype;
  v_plan public.routine_week_plans%rowtype;
  v_new_revision integer;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  if p_weekly_frequency_target not between 1 and 7 then
    raise exception using errcode = '23514', message = 'frequency_target_out_of_range';
  end if;
  select * into v_routine from public.routines
  where id = p_id and user_id = v_user_id and archived_at is null for update;
  if not found then raise exception using errcode = 'P0002', message = 'routine_not_found'; end if;
  if v_routine.revision <> p_expected_revision then raise exception using errcode = '40001', message = 'revision_conflict'; end if;
  perform public.planning_validate_routine_days(p_days);
  perform public.planning_write_routine_days(p_id, p_days);
  update public.routines set
    name = btrim(p_name),
    weekly_frequency_target = p_weekly_frequency_target,
    revision = revision + 1,
    updated_at = now()
  where id = p_id returning revision into v_new_revision;

  perform public.routine_reconcile_weeks();
  select timezone into v_timezone from public.user_preferences where user_id = v_user_id;
  v_timezone := coalesce(v_timezone, 'UTC');
  v_current_week := public.routine_week_start(now(), v_timezone);
  select * into v_active_event from public.routine_activation_events
  where user_id = v_user_id and effective_week_start <= v_current_week
  order by effective_week_start desc limit 1;
  if found and v_active_event.routine_id = p_id then
    select * into v_plan from public.routine_week_plans
    where user_id = v_user_id and week_start = v_current_week;
    v_effective_week := case when v_plan.locked_at is not null then v_current_week + 7 else v_current_week end;
    perform public.routine_upsert_activation_event(p_id, v_new_revision, v_effective_week);
    if v_effective_week = v_current_week then
      delete from public.routine_week_plans where id = v_plan.id and locked_at is null;
      perform public.routine_reconcile_weeks();
    end if;
  end if;
  return p_id;
end;
$$;

create or replace function public.planning_archive_routine(p_id uuid, p_expected_revision integer)
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
    select 1 from public.routine_activation_events e
    where e.user_id = v_user_id and e.routine_id = p_id
      and e.effective_week_start >= v_current_week
  ) or (
    select e.routine_id = p_id from public.routine_activation_events e
    where e.user_id = v_user_id and e.effective_week_start <= v_current_week
    order by e.effective_week_start desc limit 1
  ) then
    raise exception using errcode = '23514', message = 'active_routine_cannot_be_archived';
  end if;
  update public.routines set archived_at = now(), revision = revision + 1, updated_at = now()
  where id = p_id and user_id = v_user_id and archived_at is null and revision = p_expected_revision;
  if not found then
    if exists (select 1 from public.routines where id = p_id and user_id = v_user_id) then raise exception using errcode = '40001', message = 'revision_conflict'; end if;
    raise exception using errcode = 'P0002', message = 'routine_not_found';
  end if;
end;
$$;

-- Drop the old same-arity pointer start function. Its signature differs only by
-- argument meaning, so replacing it above is sufficient. Revoke every new RPC
-- from PUBLIC/anon and expose only the authenticated contracts.
revoke all on function public.routine_week_start(timestamptz, text) from public, anon, authenticated;
revoke all on function public.routine_assert_timezone(text) from public, anon, authenticated;
revoke all on function public.routine_validate_timezone_trigger() from public, anon, authenticated;
revoke all on function public.routine_days_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.routine_upsert_activation_event(uuid, integer, date) from public, anon, authenticated;
revoke all on function public.preferences_get_or_create_timezone(text) from public, anon;
revoke all on function public.preferences_update_timezone(text) from public, anon;
revoke all on function public.routine_reconcile_weeks() from public, anon;
revoke all on function public.planning_activate_routine(uuid, integer, date) from public, anon;
revoke all on function public.planning_deactivate_routine(date) from public, anon;
revoke all on function public.routine_get_current_week() from public, anon;
revoke all on function public.routine_week_to_json(uuid) from public, anon, authenticated;
revoke all on function public.routine_list_history(integer, integer) from public, anon;
revoke all on function public.routine_get_week(uuid) from public, anon;
revoke all on function public.routine_list_notifications() from public, anon;
revoke all on function public.routine_mark_notification_read(uuid) from public, anon;
revoke all on function public.routine_dismiss_notification(uuid) from public, anon;
revoke all on function public.routine_get_session_removal_impact(uuid) from public, anon;
revoke all on function public.workout_start_planned(uuid, uuid, uuid, uuid, integer) from public, anon;
revoke all on function public.planning_update_routine(uuid, integer, text, integer, jsonb) from public, anon;
revoke all on function public.planning_archive_routine(uuid, integer) from public, anon;

grant execute on function public.preferences_get_or_create_timezone(text) to authenticated;
grant execute on function public.preferences_update_timezone(text) to authenticated;
grant execute on function public.routine_reconcile_weeks() to authenticated;
grant execute on function public.planning_activate_routine(uuid, integer, date) to authenticated;
grant execute on function public.planning_deactivate_routine(date) to authenticated;
grant execute on function public.routine_get_current_week() to authenticated;
grant execute on function public.routine_list_history(integer, integer) to authenticated;
grant execute on function public.routine_get_week(uuid) to authenticated;
grant execute on function public.routine_list_notifications() to authenticated;
grant execute on function public.routine_mark_notification_read(uuid) to authenticated;
grant execute on function public.routine_dismiss_notification(uuid) to authenticated;
grant execute on function public.routine_get_session_removal_impact(uuid) to authenticated;
grant execute on function public.workout_start_planned(uuid, uuid, uuid, uuid, integer) to authenticated;
grant execute on function public.planning_update_routine(uuid, integer, text, integer, jsonb) to authenticated;
grant execute on function public.planning_archive_routine(uuid, integer) to authenticated;

-- The two legacy activation overloads remain callable only by old clients for
-- this additive release, but new code does not use them.
