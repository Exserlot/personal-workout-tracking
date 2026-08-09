create table public.devices (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  label varchar(120),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index devices_user_last_seen_idx on public.devices(user_id, last_seen_at desc);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_device_id uuid not null references public.devices(id) on delete restrict,
  source_type text not null check (source_type in ('PLANNED', 'AD_HOC')),
  source_routine_id uuid references public.routines(id) on delete set null,
  source_routine_day_id uuid references public.routine_days(id) on delete set null,
  source_template_id uuid references public.workout_templates(id) on delete set null,
  source_routine_revision integer check (source_routine_revision is null or source_routine_revision >= 1),
  source_template_revision integer check (source_template_revision is null or source_template_revision >= 1),
  snapshot_schema_version integer not null default 1 check (snapshot_schema_version >= 1),
  routine_name_snapshot varchar(160),
  day_label_snapshot varchar(80),
  template_name_snapshot varchar(160),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETED', 'DISCARDED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 2000),
  version integer not null default 1 check (version >= 1),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'COMPLETED') = (completed_at is not null)),
  check (source_type <> 'PLANNED' or (source_routine_id is not null and source_routine_day_id is not null and source_template_id is not null and template_name_snapshot is not null)),
  check (source_type <> 'AD_HOC' or source_routine_id is null)
);

create unique index workout_sessions_one_active_per_user
  on public.workout_sessions(user_id)
  where status = 'ACTIVE' and deleted_at is null;

create index workout_sessions_user_started_idx
  on public.workout_sessions(user_id, started_at desc)
  where deleted_at is null;

create index workout_sessions_user_status_idx
  on public.workout_sessions(user_id, status)
  where deleted_at is null;

create table public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  source_template_exercise_id uuid references public.template_exercises(id) on delete set null,
  source_exercise_id uuid references public.exercises(id) on delete set null,
  sequence_no integer not null check (sequence_no >= 1),
  exercise_name_snapshot varchar(160) not null,
  equipment_code_snapshot varchar(40),
  notes text not null default '' check (char_length(notes) <= 1000),
  unique (session_id, sequence_no)
);

create index workout_session_exercises_session_idx
  on public.workout_session_exercises(session_id, sequence_no);

create index workout_session_exercises_source_idx
  on public.workout_session_exercises(source_exercise_id, session_id);

create table public.workout_session_exercise_muscles (
  session_exercise_id uuid not null references public.workout_session_exercises(id) on delete cascade,
  role text not null check (role in ('PRIMARY', 'SECONDARY')),
  sequence_no integer not null check (sequence_no >= 1),
  source_muscle_id uuid references public.muscles(id) on delete set null,
  muscle_name_snapshot varchar(120) not null,
  primary key (session_exercise_id, role, sequence_no),
  unique (session_exercise_id, role, source_muscle_id)
);

create table public.workout_session_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.workout_session_exercises(id) on delete cascade,
  source_template_set_id uuid references public.template_set_prescriptions(id) on delete set null,
  sequence_no integer not null check (sequence_no >= 1),
  set_kind_code text not null default 'WORKING' check (set_kind_code in ('WARM_UP', 'WORKING', 'DROP')),
  is_to_failure boolean not null default false,
  target_reps_min integer,
  target_reps_max integer,
  target_weight_value numeric(10, 3),
  target_weight_unit text,
  target_weight_kg numeric(12, 4),
  target_effort_metric text,
  target_effort_value numeric(4, 1),
  target_rest_seconds integer not null default 0 check (target_rest_seconds between 0 and 3600),
  actual_weight_value numeric(10, 3),
  actual_weight_unit text,
  actual_weight_kg numeric(12, 4),
  actual_reps integer,
  actual_effort_metric text,
  actual_effort_value numeric(4, 1),
  actual_rest_seconds integer,
  status text not null default 'PENDING' check (status in ('PENDING', 'COMPLETED', 'SKIPPED')),
  completed_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 1000),
  unique (session_exercise_id, sequence_no),
  check (target_reps_min is null or target_reps_min >= 1),
  check (target_reps_max is null or (target_reps_max >= 1 and target_reps_min is not null and target_reps_max >= target_reps_min)),
  check ((target_weight_value is null and target_weight_unit is null and target_weight_kg is null) or (target_weight_value >= 0 and target_weight_unit in ('KG', 'LB') and target_weight_kg >= 0)),
  check ((target_effort_metric is null and target_effort_value is null) or (target_effort_metric = 'RPE' and target_effort_value between 1 and 10 and mod(target_effort_value * 2, 1) = 0) or (target_effort_metric = 'RIR' and target_effort_value between 0 and 10 and mod(target_effort_value, 1) = 0)),
  check ((actual_weight_value is null and actual_weight_unit is null and actual_weight_kg is null) or (actual_weight_value >= 0 and actual_weight_unit in ('KG', 'LB') and actual_weight_kg >= 0)),
  check ((actual_effort_metric is null and actual_effort_value is null) or (actual_effort_metric = 'RPE' and actual_effort_value between 1 and 10 and mod(actual_effort_value * 2, 1) = 0) or (actual_effort_metric = 'RIR' and actual_effort_value between 0 and 10 and mod(actual_effort_value, 1) = 0)),
  check (actual_rest_seconds is null or actual_rest_seconds >= 0),
  check ((status = 'COMPLETED') = (completed_at is not null)),
  check (status <> 'COMPLETED' or (actual_reps is not null and actual_reps >= 1 and actual_weight_value is not null)),
  check (not (set_kind_code = 'WARM_UP' and is_to_failure))
);

create index workout_session_sets_exercise_idx
  on public.workout_session_sets(session_exercise_id, sequence_no);

create index workout_session_sets_progress_idx
  on public.workout_session_sets(status, completed_at);

alter table public.workout_session_sets
  add constraint workout_session_sets_target_weight_canonical_check
  check (
    target_weight_value is null
    or target_weight_kg = round(case when target_weight_unit = 'LB' then target_weight_value * 0.45359237 else target_weight_value end, 4)
  ),
  add constraint workout_session_sets_actual_weight_canonical_check
  check (
    actual_weight_value is null
    or actual_weight_kg = round(case when actual_weight_unit = 'LB' then actual_weight_value * 0.45359237 else actual_weight_value end, 4)
  );

alter table public.devices enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.workout_session_exercise_muscles enable row level security;
alter table public.workout_session_sets enable row level security;

create policy "owners read devices" on public.devices
  for select to authenticated using (user_id = auth.uid());

create policy "owners read workout sessions" on public.workout_sessions
  for select to authenticated using (user_id = auth.uid());

create policy "owners read session exercises" on public.workout_session_exercises
  for select to authenticated using (exists (select 1 from public.workout_sessions ws where ws.id = session_id and ws.user_id = auth.uid()));

create policy "owners read session muscles" on public.workout_session_exercise_muscles
  for select to authenticated using (exists (select 1 from public.workout_session_exercises wse join public.workout_sessions ws on ws.id = wse.session_id where wse.id = session_exercise_id and ws.user_id = auth.uid()));

create policy "owners read session sets" on public.workout_session_sets
  for select to authenticated using (exists (select 1 from public.workout_session_exercises wse join public.workout_sessions ws on ws.id = wse.session_id where wse.id = session_exercise_id and ws.user_id = auth.uid()));

grant select on public.devices to authenticated;
grant select on public.workout_sessions to authenticated;
grant select on public.workout_session_exercises to authenticated;
grant select on public.workout_session_exercise_muscles to authenticated;
grant select on public.workout_session_sets to authenticated;

create or replace function public.workout_assert_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.devices where id = p_device_id and user_id = auth.uid() and revoked_at is null) then
    raise exception using errcode = 'P0001', message = 'device_not_owned';
  end if;
  update public.devices set last_seen_at = now() where id = p_device_id and user_id = auth.uid();
end;
$$;

create or replace function public.workout_register_device(p_device_id uuid, p_label text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_device_id is null then
    raise exception using errcode = '22023', message = 'device_id_required';
  end if;
  insert into public.devices(id, user_id, label)
  values (p_device_id, auth.uid(), nullif(btrim(p_label), ''))
  on conflict (id) do update
    set label = coalesce(excluded.label, public.devices.label), last_seen_at = now(), revoked_at = null
    where public.devices.user_id = auth.uid();
  perform public.workout_assert_device(p_device_id);
  return p_device_id;
end;
$$;

create or replace function public.workout_assert_template_usable(p_template_id uuid)
returns public.workout_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.workout_templates%rowtype;
begin
  select * into v_template from public.workout_templates where id = p_template_id and user_id = auth.uid() and archived_at is null for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'template_not_found';
  end if;
  if not exists (select 1 from public.template_exercises where template_id = p_template_id) then
    raise exception using errcode = '23514', message = 'template_requires_exercise';
  end if;
  if exists (
    select 1 from public.template_exercises te
    left join public.exercises e on e.id = te.exercise_id
    where te.template_id = p_template_id
      and (e.id is null or e.archived_at is not null or (e.owner_user_id is not null and e.owner_user_id <> auth.uid()))
  ) then
    raise exception using errcode = '23514', message = 'template_has_archived_exercise';
  end if;
  if exists (
    select 1 from public.template_exercises te
    where te.template_id = p_template_id
      and not exists (select 1 from public.template_set_prescriptions tsp where tsp.template_exercise_id = te.id)
  ) then
    raise exception using errcode = '23514', message = 'template_requires_prescription';
  end if;
  return v_template;
end;
$$;

create or replace function public.workout_copy_template_snapshot(p_session_id uuid, p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template_exercise record;
  v_session_exercise_id uuid;
begin
  for v_template_exercise in
    select te.id, te.exercise_id, te.sequence_no, te.notes, e.name, e.equipment_code, e.primary_muscle_id
    from public.template_exercises te
    join public.exercises e on e.id = te.exercise_id
    where te.template_id = p_template_id
    order by te.sequence_no
  loop
    insert into public.workout_session_exercises(session_id, source_template_exercise_id, source_exercise_id, sequence_no, exercise_name_snapshot, equipment_code_snapshot, notes)
    values (p_session_id, v_template_exercise.id, v_template_exercise.exercise_id, v_template_exercise.sequence_no, v_template_exercise.name, v_template_exercise.equipment_code, v_template_exercise.notes)
    returning id into v_session_exercise_id;

    insert into public.workout_session_exercise_muscles(session_exercise_id, role, sequence_no, source_muscle_id, muscle_name_snapshot)
    select v_session_exercise_id, 'PRIMARY', 1, m.id, m.name from public.muscles m where m.id = v_template_exercise.primary_muscle_id;

    insert into public.workout_session_exercise_muscles(session_exercise_id, role, sequence_no, source_muscle_id, muscle_name_snapshot)
    select v_session_exercise_id, 'SECONDARY', esm.sequence_no, esm.muscle_id, m.name
    from public.exercise_secondary_muscles esm
    join public.muscles m on m.id = esm.muscle_id
    where esm.exercise_id = v_template_exercise.exercise_id
    order by esm.sequence_no;

    insert into public.workout_session_sets(
      session_exercise_id, source_template_set_id, sequence_no, set_kind_code, is_to_failure,
      target_reps_min, target_reps_max, target_weight_value, target_weight_unit, target_weight_kg,
      target_effort_metric, target_effort_value, target_rest_seconds
    )
    select v_session_exercise_id, tsp.id, tsp.sequence_no, tsp.set_kind_code, tsp.is_to_failure,
      tsp.target_reps_min, tsp.target_reps_max, tsp.target_weight_value, tsp.target_weight_unit, tsp.target_weight_kg,
      tsp.target_effort_metric, tsp.target_effort_value, tsp.target_rest_seconds
    from public.template_set_prescriptions tsp
    where tsp.template_exercise_id = v_template_exercise.id
    order by tsp.sequence_no;
  end loop;
end;
$$;

create or replace function public.workout_start_planned(
  p_session_id uuid,
  p_device_id uuid,
  p_expected_routine_id uuid,
  p_expected_routine_revision integer default null,
  p_expected_template_revision integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.workout_sessions%rowtype;
  v_routine public.routines%rowtype;
  v_day public.routine_days%rowtype;
  v_template public.workout_templates%rowtype;
  v_template_day_count integer;
begin
  perform public.workout_assert_device(p_device_id);
  select * into v_existing from public.workout_sessions where id = p_session_id and user_id = auth.uid();
  if found then
    if v_existing.status = 'ACTIVE' and v_existing.owner_device_id = p_device_id then return p_session_id; end if;
    raise exception using errcode = 'P0001', message = 'session_id_conflict';
  end if;
  if exists (select 1 from public.workout_sessions where user_id = auth.uid() and status = 'ACTIVE' and deleted_at is null for update) then
    raise exception using errcode = '23505', message = 'active_session_exists';
  end if;

  select * into v_routine from public.routines where id = p_expected_routine_id and user_id = auth.uid() and is_active and archived_at is null for update;
  if not found then raise exception using errcode = 'P0002', message = 'active_routine_not_found'; end if;
  if p_expected_routine_revision is not null and v_routine.revision <> p_expected_routine_revision then raise exception using errcode = '40001', message = 'revision_conflict'; end if;

  select count(*) into v_template_day_count from public.routine_days where routine_id = v_routine.id;
  if v_template_day_count < 1 then raise exception using errcode = '23514', message = 'routine_requires_day'; end if;
  select * into v_day from public.routine_days where routine_id = v_routine.id and sequence_no = least(v_routine.next_workout_index, v_template_day_count - 1) + 1;
  if not found then raise exception using errcode = '23514', message = 'routine_day_not_found'; end if;
  v_template := public.workout_assert_template_usable(v_day.template_id);
  if p_expected_template_revision is not null and v_template.revision <> p_expected_template_revision then raise exception using errcode = '40001', message = 'revision_conflict'; end if;

  insert into public.workout_sessions(
    id, user_id, owner_device_id, source_type, source_routine_id, source_routine_day_id, source_template_id,
    source_routine_revision, source_template_revision, routine_name_snapshot, day_label_snapshot, template_name_snapshot
  ) values (
    p_session_id, auth.uid(), p_device_id, 'PLANNED', v_routine.id, v_day.id, v_template.id,
    v_routine.revision, v_template.revision, v_routine.name, v_day.label, v_template.name
  );
  perform public.workout_copy_template_snapshot(p_session_id, v_template.id);
  return p_session_id;
end;
$$;

create or replace function public.workout_start_adhoc(
  p_session_id uuid,
  p_device_id uuid,
  p_template_id uuid default null,
  p_expected_template_revision integer default null,
  p_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.workout_sessions%rowtype;
  v_template public.workout_templates%rowtype;
begin
  perform public.workout_assert_device(p_device_id);
  select * into v_existing from public.workout_sessions where id = p_session_id and user_id = auth.uid();
  if found then
    if v_existing.status = 'ACTIVE' and v_existing.owner_device_id = p_device_id then return p_session_id; end if;
    raise exception using errcode = 'P0001', message = 'session_id_conflict';
  end if;
  if exists (select 1 from public.workout_sessions where user_id = auth.uid() and status = 'ACTIVE' and deleted_at is null for update) then
    raise exception using errcode = '23505', message = 'active_session_exists';
  end if;

  if p_template_id is not null then
    v_template := public.workout_assert_template_usable(p_template_id);
    if p_expected_template_revision is not null and v_template.revision <> p_expected_template_revision then raise exception using errcode = '40001', message = 'revision_conflict'; end if;
  end if;
  insert into public.workout_sessions(id, user_id, owner_device_id, source_type, source_template_id, source_template_revision, template_name_snapshot, notes)
  values (p_session_id, auth.uid(), p_device_id, 'AD_HOC', p_template_id, nullif(v_template.revision, 0), case when p_template_id is null then null else v_template.name end, left(coalesce(p_name, ''), 0));
  if p_template_id is not null then perform public.workout_copy_template_snapshot(p_session_id, p_template_id); end if;
  return p_session_id;
end;
$$;

create or replace function public.workout_touch_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.workout_sessions set version = version + 1, edited_at = now(), updated_at = now() where id = p_session_id;
end;
$$;

create or replace function public.workout_apply_command(
  p_session_id uuid,
  p_device_id uuid,
  p_expected_version integer,
  p_command jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.workout_sessions%rowtype;
  v_action text := p_command->>'action';
  v_set_id uuid;
  v_exercise_id uuid;
  v_sequence integer;
  v_weight numeric;
  v_unit text;
  v_metric text;
  v_effort numeric;
  v_reps integer;
  v_kind text;
  v_exercise public.exercises%rowtype;
  v_new_exercise_id uuid;
  v_set_exercise_id uuid;
  v_deleted_sequence integer;
begin
  perform public.workout_assert_device(p_device_id);
  select * into v_session from public.workout_sessions where id = p_session_id for update;
  if not found or v_session.user_id <> auth.uid() then raise exception using errcode = 'P0002', message = 'session_not_found'; end if;
  if v_session.status <> 'ACTIVE' then raise exception using errcode = 'P0001', message = 'session_not_active'; end if;
  if v_session.owner_device_id <> p_device_id then raise exception using errcode = 'P0001', message = 'device_locked'; end if;
  if v_session.version <> p_expected_version then raise exception using errcode = '40001', message = 'revision_conflict'; end if;

  if v_action in ('complete_set', 'edit_set') then
    v_set_id := nullif(p_command->>'set_id', '')::uuid;
    v_weight := nullif(p_command->>'actual_weight_value', '')::numeric;
    v_unit := nullif(p_command->>'actual_weight_unit', '');
    v_reps := nullif(p_command->>'actual_reps', '')::integer;
    v_metric := nullif(p_command->>'actual_effort_metric', '');
    v_effort := nullif(p_command->>'actual_effort_value', '')::numeric;
    if v_weight is null or v_weight < 0 or v_unit not in ('KG', 'LB') or v_reps is null or v_reps < 1 then raise exception using errcode = '23514', message = 'invalid_actual_set'; end if;
    if v_metric is not null and not ((v_metric = 'RPE' and v_effort between 1 and 10 and mod(v_effort * 2, 1) = 0) or (v_metric = 'RIR' and v_effort between 0 and 10 and mod(v_effort, 1) = 0)) then raise exception using errcode = '23514', message = 'invalid_actual_effort'; end if;
    if v_metric is null and v_effort is not null then raise exception using errcode = '23514', message = 'invalid_actual_effort'; end if;
    update public.workout_session_sets
    set actual_weight_value = v_weight, actual_weight_unit = v_unit,
        actual_weight_kg = case when v_unit = 'LB' then round(v_weight * 0.45359237, 4) else round(v_weight, 4) end,
        actual_reps = v_reps, actual_effort_metric = v_metric, actual_effort_value = v_effort,
        status = 'COMPLETED', completed_at = coalesce(completed_at, now())
    where id = v_set_id and exists (select 1 from public.workout_session_exercises where id = session_exercise_id and session_id = p_session_id);
    if not found then raise exception using errcode = 'P0002', message = 'set_not_found'; end if;
  elsif v_action = 'skip_set' then
    v_set_id := nullif(p_command->>'set_id', '')::uuid;
    update public.workout_session_sets set status = 'SKIPPED', completed_at = null where id = v_set_id and status <> 'COMPLETED' and exists (select 1 from public.workout_session_exercises where id = session_exercise_id and session_id = p_session_id);
    if not found then raise exception using errcode = 'P0002', message = 'set_not_found'; end if;
  elsif v_action = 'move_set' then
    v_set_id := nullif(p_command->>'set_id', '')::uuid;
    v_sequence := (p_command->>'sequence_no')::integer;
    select session_exercise_id, sequence_no into v_set_exercise_id, v_deleted_sequence from public.workout_session_sets where id = v_set_id;
    if v_set_exercise_id is null or not exists (select 1 from public.workout_session_exercises where id = v_set_exercise_id and session_id = p_session_id) then raise exception using errcode = 'P0002', message = 'set_not_found'; end if;
    v_sequence := greatest(1, least(v_sequence, (select count(*) from public.workout_session_sets where session_exercise_id = v_set_exercise_id)));
    update public.workout_session_sets set sequence_no = 1000000 where id = v_set_id;
    update public.workout_session_sets set sequence_no = 1000000 + ordered.position
    from (
      select id, row_number() over (
        order by case
          when id = v_set_id then v_sequence
          when v_deleted_sequence < v_sequence and sequence_no > v_deleted_sequence and sequence_no <= v_sequence then sequence_no - 1
          when v_deleted_sequence > v_sequence and sequence_no >= v_sequence and sequence_no < v_deleted_sequence then sequence_no + 1
          else sequence_no
        end, id
      )::integer as position
      from public.workout_session_sets
      where session_exercise_id = v_set_exercise_id
    ) ordered
    where public.workout_session_sets.id = ordered.id;
    update public.workout_session_sets set sequence_no = sequence_no - 1000000 where session_exercise_id = v_set_exercise_id;
  elsif v_action = 'delete_set' then
    v_set_id := nullif(p_command->>'set_id', '')::uuid;
    select session_exercise_id, sequence_no into v_set_exercise_id, v_deleted_sequence from public.workout_session_sets where id = v_set_id;
    if v_set_exercise_id is null then raise exception using errcode = 'P0002', message = 'set_not_found'; end if;
    if (select count(*) from public.workout_session_sets where session_exercise_id = v_set_exercise_id) <= 1 then raise exception using errcode = '23514', message = 'cannot_delete_last_set'; end if;
    delete from public.workout_session_sets where id = v_set_id and exists (select 1 from public.workout_session_exercises where id = session_exercise_id and session_id = p_session_id);
    if not found then raise exception using errcode = 'P0002', message = 'set_not_found'; end if;
    update public.workout_session_sets set sequence_no = sequence_no - 1 where session_exercise_id = v_set_exercise_id and sequence_no > v_deleted_sequence;
  elsif v_action = 'add_set' then
    v_exercise_id := nullif(p_command->>'session_exercise_id', '')::uuid;
    v_sequence := (p_command->>'sequence_no')::integer;
    if not exists (select 1 from public.workout_session_exercises where id = v_exercise_id and session_id = p_session_id) then raise exception using errcode = 'P0002', message = 'exercise_not_found'; end if;
    if v_sequence < 1 or v_sequence <> coalesce((select max(sequence_no) + 1 from public.workout_session_sets where session_exercise_id = v_exercise_id), 1) then raise exception using errcode = '23514', message = 'invalid_set_sequence'; end if;
    insert into public.workout_session_sets(id, session_exercise_id, sequence_no, set_kind_code, target_reps_min, target_reps_max, target_weight_value, target_weight_unit, target_weight_kg, target_effort_metric, target_effort_value, target_rest_seconds)
    values (coalesce(nullif(p_command->>'set_id', '')::uuid, gen_random_uuid()), v_exercise_id, v_sequence, coalesce(p_command->>'set_kind_code', 'WORKING'), (p_command->>'target_reps_min')::integer, (p_command->>'target_reps_max')::integer, nullif(p_command->>'target_weight_value', '')::numeric, nullif(p_command->>'target_weight_unit', ''), case when nullif(p_command->>'target_weight_value', '')::numeric is null then null when nullif(p_command->>'target_weight_unit', '') = 'LB' then round(nullif(p_command->>'target_weight_value', '')::numeric * 0.45359237, 4) else round(nullif(p_command->>'target_weight_value', '')::numeric, 4) end, nullif(p_command->>'target_effort_metric', ''), nullif(p_command->>'target_effort_value', '')::numeric, coalesce((p_command->>'target_rest_seconds')::integer, 0));
  elsif v_action = 'set_kind' then
    v_set_id := nullif(p_command->>'set_id', '')::uuid;
    v_kind := p_command->>'set_kind_code';
    if v_kind not in ('WARM_UP', 'WORKING') then raise exception using errcode = '23514', message = 'unsupported_set_kind'; end if;
    update public.workout_session_sets set set_kind_code = v_kind, is_to_failure = false where id = v_set_id and exists (select 1 from public.workout_session_exercises where id = session_exercise_id and session_id = p_session_id);
    if not found then raise exception using errcode = 'P0002', message = 'set_not_found'; end if;
  elsif v_action = 'add_exercise' then
    v_exercise_id := nullif(p_command->>'exercise_id', '')::uuid;
    select * into v_exercise from public.exercises where id = v_exercise_id and archived_at is null and (owner_user_id is null or owner_user_id = auth.uid());
    if not found then raise exception using errcode = '23514', message = 'exercise_not_available'; end if;
    v_sequence := (p_command->>'sequence_no')::integer;
    if v_sequence < 1 or v_sequence <> coalesce((select max(sequence_no) + 1 from public.workout_session_exercises where session_id = p_session_id), 1) then raise exception using errcode = '23514', message = 'invalid_exercise_sequence'; end if;
    insert into public.workout_session_exercises(id, session_id, source_exercise_id, sequence_no, exercise_name_snapshot, equipment_code_snapshot, notes)
    values (coalesce(nullif(p_command->>'session_exercise_id', '')::uuid, gen_random_uuid()), p_session_id, v_exercise.id, v_sequence, v_exercise.name, v_exercise.equipment_code, coalesce(p_command->>'notes', '')) returning id into v_new_exercise_id;
    insert into public.workout_session_exercise_muscles(session_exercise_id, role, sequence_no, source_muscle_id, muscle_name_snapshot) select v_new_exercise_id, 'PRIMARY', 1, m.id, m.name from public.muscles m where m.id = v_exercise.primary_muscle_id;
    insert into public.workout_session_exercise_muscles(session_exercise_id, role, sequence_no, source_muscle_id, muscle_name_snapshot) select v_new_exercise_id, 'SECONDARY', esm.sequence_no, esm.muscle_id, m.name from public.exercise_secondary_muscles esm join public.muscles m on m.id = esm.muscle_id where esm.exercise_id = v_exercise.id order by esm.sequence_no;
    insert into public.workout_session_sets(id, session_exercise_id, sequence_no, set_kind_code, target_reps_min, target_reps_max, target_weight_value, target_weight_unit, target_weight_kg, target_effort_metric, target_effort_value, target_rest_seconds)
    values (coalesce(nullif(p_command->>'set_id', '')::uuid, gen_random_uuid()), v_new_exercise_id, 1, coalesce(p_command->>'set_kind_code', 'WORKING'), coalesce((p_command->>'target_reps_min')::integer, 8), coalesce((p_command->>'target_reps_max')::integer, 10), nullif(p_command->>'target_weight_value', '')::numeric, nullif(p_command->>'target_weight_unit', ''), nullif(p_command->>'target_weight_kg', '')::numeric, nullif(p_command->>'target_effort_metric', ''), nullif(p_command->>'target_effort_value', '')::numeric, coalesce((p_command->>'target_rest_seconds')::integer, 90));
  elsif v_action = 'remove_exercise' then
    v_exercise_id := nullif(p_command->>'session_exercise_id', '')::uuid;
    select sequence_no into v_deleted_sequence from public.workout_session_exercises where id = v_exercise_id and session_id = p_session_id;
    if v_deleted_sequence is null then raise exception using errcode = 'P0002', message = 'exercise_not_found'; end if;
    delete from public.workout_session_exercises where id = v_exercise_id and session_id = p_session_id;
    update public.workout_session_exercises set sequence_no = sequence_no - 1 where session_id = p_session_id and sequence_no > v_deleted_sequence;
  elsif v_action = 'move_exercise' then
    v_exercise_id := nullif(p_command->>'session_exercise_id', '')::uuid;
    v_sequence := (p_command->>'sequence_no')::integer;
    select sequence_no into v_deleted_sequence from public.workout_session_exercises where id = v_exercise_id and session_id = p_session_id;
    if not found then raise exception using errcode = 'P0002', message = 'exercise_not_found'; end if;
    v_sequence := greatest(1, least(v_sequence, (select count(*) from public.workout_session_exercises where session_id = p_session_id)));
    update public.workout_session_exercises set sequence_no = 1000000 where id = v_exercise_id;
    update public.workout_session_exercises set sequence_no = 1000000 + ordered.position
    from (
      select id, row_number() over (
        order by case
          when id = v_exercise_id then v_sequence
          when v_deleted_sequence < v_sequence and sequence_no > v_deleted_sequence and sequence_no <= v_sequence then sequence_no - 1
          when v_deleted_sequence > v_sequence and sequence_no >= v_sequence and sequence_no < v_deleted_sequence then sequence_no + 1
          else sequence_no
        end, id
      )::integer as position
      from public.workout_session_exercises
      where session_id = p_session_id
    ) ordered
    where public.workout_session_exercises.id = ordered.id;
    update public.workout_session_exercises set sequence_no = sequence_no - 1000000 where session_id = p_session_id;
  elsif v_action = 'update_session_notes' then
    update public.workout_sessions set notes = left(coalesce(p_command->>'notes', ''), 2000) where id = p_session_id;
  elsif v_action = 'update_exercise_notes' then
    update public.workout_session_exercises set notes = left(coalesce(p_command->>'notes', ''), 1000) where id = nullif(p_command->>'session_exercise_id', '')::uuid and session_id = p_session_id;
    if not found then raise exception using errcode = 'P0002', message = 'exercise_not_found'; end if;
  else
    raise exception using errcode = '22023', message = 'unsupported_workout_command';
  end if;

  perform public.workout_touch_session(p_session_id);
  select version into v_sequence from public.workout_sessions where id = p_session_id;
  return v_sequence;
end;
$$;

create or replace function public.workout_finish_session(p_session_id uuid, p_device_id uuid, p_expected_version integer)
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
  perform public.workout_assert_device(p_device_id);
  select * into v_session from public.workout_sessions where id = p_session_id for update;
  if not found or v_session.user_id <> auth.uid() then raise exception using errcode = 'P0002', message = 'session_not_found'; end if;
  if v_session.status = 'COMPLETED' then return p_session_id; end if;
  if v_session.status <> 'ACTIVE' then raise exception using errcode = 'P0001', message = 'session_not_active'; end if;
  if v_session.owner_device_id <> p_device_id then raise exception using errcode = 'P0001', message = 'device_locked'; end if;
  if v_session.version <> p_expected_version then raise exception using errcode = '40001', message = 'revision_conflict'; end if;

  update public.workout_sessions set status = 'COMPLETED', completed_at = now(), version = version + 1, edited_at = now(), updated_at = now() where id = p_session_id;
  if v_session.source_type = 'PLANNED' then
    select * into v_routine from public.routines where id = v_session.source_routine_id and user_id = auth.uid() and is_active and archived_at is null for update;
    if not found then raise exception using errcode = '40001', message = 'active_routine_changed'; end if;
    select count(*) into v_day_count from public.routine_days where routine_id = v_routine.id;
    update public.routines set next_workout_index = case when v_day_count < 1 then 0 else (v_routine.next_workout_index + 1) % v_day_count end, revision = revision + 1, updated_at = now() where id = v_routine.id;
  end if;
  return p_session_id;
end;
$$;

create or replace function public.workout_discard_session(p_session_id uuid, p_device_id uuid, p_expected_version integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.workout_sessions%rowtype;
begin
  perform public.workout_assert_device(p_device_id);
  select * into v_session from public.workout_sessions where id = p_session_id for update;
  if not found or v_session.user_id <> auth.uid() then raise exception using errcode = 'P0002', message = 'session_not_found'; end if;
  if v_session.status = 'DISCARDED' then return p_session_id; end if;
  if v_session.status <> 'ACTIVE' then raise exception using errcode = 'P0001', message = 'session_not_active'; end if;
  if v_session.owner_device_id <> p_device_id then raise exception using errcode = 'P0001', message = 'device_locked'; end if;
  if v_session.version <> p_expected_version then raise exception using errcode = '40001', message = 'revision_conflict'; end if;
  update public.workout_sessions set status = 'DISCARDED', version = version + 1, edited_at = now(), updated_at = now() where id = p_session_id;
  return p_session_id;
end;
$$;

revoke all on function public.workout_assert_device(uuid) from public, authenticated;
revoke all on function public.workout_register_device(uuid, text) from public;
revoke all on function public.workout_assert_template_usable(uuid) from public, authenticated;
revoke all on function public.workout_copy_template_snapshot(uuid, uuid) from public, authenticated;
revoke all on function public.workout_start_planned(uuid, uuid, uuid, integer, integer) from public;
revoke all on function public.workout_start_adhoc(uuid, uuid, uuid, integer, text) from public;
revoke all on function public.workout_touch_session(uuid) from public, authenticated;
revoke all on function public.workout_apply_command(uuid, uuid, integer, jsonb) from public;
revoke all on function public.workout_finish_session(uuid, uuid, integer) from public;
revoke all on function public.workout_discard_session(uuid, uuid, integer) from public;

grant execute on function public.workout_register_device(uuid, text) to authenticated;
grant execute on function public.workout_start_planned(uuid, uuid, uuid, integer, integer) to authenticated;
grant execute on function public.workout_start_adhoc(uuid, uuid, uuid, integer, text) to authenticated;
grant execute on function public.workout_apply_command(uuid, uuid, integer, jsonb) to authenticated;
grant execute on function public.workout_finish_session(uuid, uuid, integer) to authenticated;
grant execute on function public.workout_discard_session(uuid, uuid, integer) to authenticated;
