create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  notes text not null default '' check (char_length(notes) <= 2000),
  revision integer not null default 1 check (revision >= 1),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  sequence_no integer not null check (sequence_no >= 1),
  notes text not null default '' check (char_length(notes) <= 1000),
  unique (template_id, sequence_no)
);

create table public.template_set_prescriptions (
  id uuid primary key default gen_random_uuid(),
  template_exercise_id uuid not null references public.template_exercises(id) on delete cascade,
  sequence_no integer not null check (sequence_no >= 1),
  set_kind_code text not null default 'WORKING' check (set_kind_code in ('WARM_UP', 'WORKING', 'DROP')),
  is_to_failure boolean not null default false,
  target_reps_min integer not null check (target_reps_min >= 1),
  target_reps_max integer not null check (target_reps_max >= target_reps_min),
  target_weight_value numeric(10, 3),
  target_weight_unit text check (target_weight_unit in ('KG', 'LB')),
  target_weight_kg numeric(10, 4),
  target_effort_metric text check (target_effort_metric in ('RPE', 'RIR')),
  target_effort_value numeric(4, 1),
  target_rest_seconds integer not null default 0 check (target_rest_seconds between 0 and 3600),
  unique (template_exercise_id, sequence_no),
  check (
    (target_weight_value is null and target_weight_unit is null and target_weight_kg is null)
    or (target_weight_value >= 0 and target_weight_unit is not null and target_weight_kg >= 0)
  ),
  check (
    (target_effort_metric is null and target_effort_value is null)
    or (target_effort_metric = 'RPE' and target_effort_value between 1 and 10 and mod(target_effort_value * 2, 1) = 0)
    or (target_effort_metric = 'RIR' and target_effort_value between 0 and 10 and mod(target_effort_value, 1) = 0)
  )
);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  weekly_frequency_target integer not null check (weekly_frequency_target between 1 and 7),
  next_workout_index integer not null default 0 check (next_workout_index >= 0),
  is_active boolean not null default false,
  revision integer not null default 1 check (revision >= 1),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_active or archived_at is null)
);

create table public.routine_days (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  template_id uuid not null references public.workout_templates(id) on delete restrict,
  sequence_no integer not null check (sequence_no >= 1),
  label text not null default '' check (char_length(label) <= 80),
  notes text not null default '' check (char_length(notes) <= 1000),
  unique (routine_id, sequence_no)
);

create unique index routines_one_active_per_user
  on public.routines(user_id)
  where is_active and archived_at is null;

create index workout_templates_user_id_idx on public.workout_templates(user_id);
create index template_exercises_template_id_idx on public.template_exercises(template_id);
create index template_set_prescriptions_exercise_idx on public.template_set_prescriptions(template_exercise_id);
create index routines_user_id_idx on public.routines(user_id);
create index routine_days_routine_id_idx on public.routine_days(routine_id);
create index routine_days_template_id_idx on public.routine_days(template_id);

alter table public.workout_templates enable row level security;
alter table public.template_exercises enable row level security;
alter table public.template_set_prescriptions enable row level security;
alter table public.routines enable row level security;
alter table public.routine_days enable row level security;

create policy "owners manage workout templates" on public.workout_templates
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owners manage template exercises" on public.template_exercises
  for all to authenticated
  using (exists (
    select 1 from public.workout_templates wt
    where wt.id = template_exercises.template_id and wt.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workout_templates wt
    where wt.id = template_exercises.template_id and wt.user_id = auth.uid()
  ));

create policy "owners manage set prescriptions" on public.template_set_prescriptions
  for all to authenticated
  using (exists (
    select 1
    from public.template_exercises te
    join public.workout_templates wt on wt.id = te.template_id
    where te.id = template_set_prescriptions.template_exercise_id and wt.user_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.template_exercises te
    join public.workout_templates wt on wt.id = te.template_id
    where te.id = template_set_prescriptions.template_exercise_id and wt.user_id = auth.uid()
  ));

create policy "owners manage routines" on public.routines
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owners manage routine days" on public.routine_days
  for all to authenticated
  using (exists (
    select 1 from public.routines r
    where r.id = routine_days.routine_id and r.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.routines r
    where r.id = routine_days.routine_id and r.user_id = auth.uid()
  ));

grant select, insert, update, delete on public.workout_templates to authenticated;
grant select, insert, update, delete on public.template_exercises to authenticated;
grant select, insert, update, delete on public.template_set_prescriptions to authenticated;
grant select, insert, update, delete on public.routines to authenticated;
grant select, insert, update, delete on public.routine_days to authenticated;

create or replace function public.planning_write_template_children(
  p_template_id uuid,
  p_exercises jsonb,
  p_allow_existing_archived boolean default false
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_exercise jsonb;
  v_set jsonb;
  v_template_exercise_id uuid;
  v_exercise_id uuid;
  v_archived_at timestamptz;
  v_weight numeric;
  v_unit text;
  v_metric text;
  v_effort numeric;
begin
  if not exists (
    select 1 from public.workout_templates
    where id = p_template_id and user_id = auth.uid()
  ) then
    raise exception using errcode = 'P0002', message = 'template_not_found';
  end if;

  if jsonb_typeof(coalesce(p_exercises, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid_exercises';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) with ordinality as rows(value, ordinal)
    where (value->>'sequence_no')::integer <> ordinal
  ) then
    raise exception using errcode = '23514', message = 'invalid_exercise_sequence';
  end if;

  for v_exercise in select value from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb))
  loop
    v_exercise_id := (v_exercise->>'exercise_id')::uuid;
    select archived_at into v_archived_at
    from public.exercises
    where id = v_exercise_id
      and (owner_user_id is null or owner_user_id = auth.uid());

    if not found then
      raise exception using errcode = '23503', message = 'exercise_not_available';
    end if;
    if v_archived_at is not null and not (
      p_allow_existing_archived and exists (
        select 1 from public.template_exercises
        where template_id = p_template_id and exercise_id = v_exercise_id
      )
    ) then
      raise exception using errcode = '23514', message = 'archived_exercise_cannot_be_added';
    end if;
    if jsonb_typeof(coalesce(v_exercise->'sets', '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(v_exercise->'sets', '[]'::jsonb)) < 1 then
      raise exception using errcode = '23514', message = 'exercise_requires_prescription';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_exercise->'sets') with ordinality as rows(value, ordinal)
      where (value->>'sequence_no')::integer <> ordinal
    ) then
      raise exception using errcode = '23514', message = 'invalid_set_sequence';
    end if;
  end loop;

  delete from public.template_exercises where template_id = p_template_id;

  for v_exercise in select value from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb))
  loop
    insert into public.template_exercises(template_id, exercise_id, sequence_no, notes)
    values (
      p_template_id,
      (v_exercise->>'exercise_id')::uuid,
      (v_exercise->>'sequence_no')::integer,
      coalesce(v_exercise->>'notes', '')
    ) returning id into v_template_exercise_id;

    for v_set in select value from jsonb_array_elements(v_exercise->'sets')
    loop
      v_weight := nullif(v_set->>'target_weight_value', '')::numeric;
      v_unit := nullif(v_set->>'target_weight_unit', '');
      v_metric := nullif(v_set->>'target_effort_metric', '');
      v_effort := nullif(v_set->>'target_effort_value', '')::numeric;

      insert into public.template_set_prescriptions(
        template_exercise_id,
        sequence_no,
        set_kind_code,
        is_to_failure,
        target_reps_min,
        target_reps_max,
        target_weight_value,
        target_weight_unit,
        target_weight_kg,
        target_effort_metric,
        target_effort_value,
        target_rest_seconds
      ) values (
        v_template_exercise_id,
        (v_set->>'sequence_no')::integer,
        coalesce(v_set->>'set_kind_code', 'WORKING'),
        coalesce((v_set->>'is_to_failure')::boolean, false),
        (v_set->>'target_reps_min')::integer,
        (v_set->>'target_reps_max')::integer,
        v_weight,
        v_unit,
        case
          when v_weight is null then null
          when v_unit = 'LB' then round(v_weight * 0.45359237, 4)
          else round(v_weight, 4)
        end,
        v_metric,
        v_effort,
        (v_set->>'target_rest_seconds')::integer
      );
    end loop;
  end loop;
end;
$$;

create or replace function public.planning_create_template(
  p_name text,
  p_notes text,
  p_exercises jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.workout_templates(user_id, name, notes)
  values (auth.uid(), btrim(p_name), coalesce(p_notes, ''))
  returning id into v_id;

  perform public.planning_write_template_children(v_id, coalesce(p_exercises, '[]'::jsonb), false);
  return v_id;
end;
$$;

create or replace function public.planning_update_template(
  p_id uuid,
  p_expected_revision integer,
  p_name text,
  p_notes text,
  p_exercises jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workout_templates
    where id = p_id and user_id = auth.uid() and archived_at is null
  ) then
    raise exception using errcode = 'P0002', message = 'template_not_found';
  end if;
  if not exists (
    select 1 from public.workout_templates
    where id = p_id and revision = p_expected_revision
  ) then
    raise exception using errcode = '40001', message = 'revision_conflict';
  end if;

  perform public.planning_write_template_children(p_id, coalesce(p_exercises, '[]'::jsonb), true);
  update public.workout_templates
  set name = btrim(p_name), notes = coalesce(p_notes, ''), revision = revision + 1, updated_at = now()
  where id = p_id;
  return p_id;
end;
$$;

create or replace function public.planning_duplicate_template(p_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source public.workout_templates%rowtype;
  v_new_id uuid;
  v_old_exercise record;
  v_new_exercise_id uuid;
begin
  select * into v_source from public.workout_templates
  where id = p_id and user_id = auth.uid() and archived_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'template_not_found';
  end if;

  insert into public.workout_templates(user_id, name, notes)
  values (auth.uid(), left(v_source.name || ' (Copy)', 160), v_source.notes)
  returning id into v_new_id;

  for v_old_exercise in
    select * from public.template_exercises where template_id = p_id order by sequence_no
  loop
    insert into public.template_exercises(template_id, exercise_id, sequence_no, notes)
    values (v_new_id, v_old_exercise.exercise_id, v_old_exercise.sequence_no, v_old_exercise.notes)
    returning id into v_new_exercise_id;

    insert into public.template_set_prescriptions(
      template_exercise_id, sequence_no, set_kind_code, is_to_failure,
      target_reps_min, target_reps_max, target_weight_value, target_weight_unit,
      target_weight_kg, target_effort_metric, target_effort_value, target_rest_seconds
    )
    select v_new_exercise_id, sequence_no, set_kind_code, is_to_failure,
      target_reps_min, target_reps_max, target_weight_value, target_weight_unit,
      target_weight_kg, target_effort_metric, target_effort_value, target_rest_seconds
    from public.template_set_prescriptions
    where template_exercise_id = v_old_exercise.id;
  end loop;
  return v_new_id;
end;
$$;

create or replace function public.planning_archive_template(p_id uuid, p_expected_revision integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.routine_days rd
    join public.routines r on r.id = rd.routine_id
    where rd.template_id = p_id and r.user_id = auth.uid() and r.archived_at is null
  ) then
    raise exception using errcode = '23503', message = 'template_referenced_by_routine';
  end if;

  update public.workout_templates
  set archived_at = now(), revision = revision + 1, updated_at = now()
  where id = p_id and user_id = auth.uid() and archived_at is null and revision = p_expected_revision;
  if not found then
    if exists (select 1 from public.workout_templates where id = p_id and user_id = auth.uid()) then
      raise exception using errcode = '40001', message = 'revision_conflict';
    end if;
    raise exception using errcode = 'P0002', message = 'template_not_found';
  end if;
end;
$$;

create or replace function public.planning_validate_routine_days(p_days jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day jsonb;
  v_template_id uuid;
begin
  if jsonb_typeof(coalesce(p_days, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_days, '[]'::jsonb)) < 1 then
    raise exception using errcode = '23514', message = 'routine_requires_day';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_days, '[]'::jsonb)) with ordinality as rows(value, ordinal)
    where (value->>'sequence_no')::integer <> ordinal
  ) then
    raise exception using errcode = '23514', message = 'invalid_routine_sequence';
  end if;

  for v_day in select value from jsonb_array_elements(p_days)
  loop
    v_template_id := (v_day->>'template_id')::uuid;
    if not exists (
      select 1
      from public.workout_templates wt
      where wt.id = v_template_id
        and wt.user_id = auth.uid()
        and wt.archived_at is null
        and exists (
          select 1 from public.template_exercises te
          where te.template_id = wt.id
        )
        and not exists (
          select 1
          from public.template_exercises te
          where te.template_id = wt.id
            and not exists (
              select 1 from public.template_set_prescriptions tsp
              where tsp.template_exercise_id = te.id
            )
        )
    ) then
      raise exception using errcode = '23514', message = 'routine_template_invalid';
    end if;
  end loop;
end;
$$;

create or replace function public.planning_write_routine_days(p_routine_id uuid, p_days jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day jsonb;
begin
  perform public.planning_validate_routine_days(p_days);
  delete from public.routine_days where routine_id = p_routine_id;
  for v_day in select value from jsonb_array_elements(p_days)
  loop
    insert into public.routine_days(routine_id, template_id, sequence_no, label, notes)
    values (
      p_routine_id,
      (v_day->>'template_id')::uuid,
      (v_day->>'sequence_no')::integer,
      coalesce(v_day->>'label', ''),
      coalesce(v_day->>'notes', '')
    );
  end loop;
end;
$$;

create or replace function public.planning_create_routine(
  p_name text,
  p_weekly_frequency_target integer,
  p_days jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.planning_validate_routine_days(p_days);
  insert into public.routines(user_id, name, weekly_frequency_target)
  values (auth.uid(), btrim(p_name), p_weekly_frequency_target)
  returning id into v_id;
  perform public.planning_write_routine_days(v_id, p_days);
  return v_id;
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
security invoker
set search_path = ''
as $$
declare
  v_next integer;
begin
  select next_workout_index into v_next
  from public.routines
  where id = p_id and user_id = auth.uid() and archived_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'routine_not_found';
  end if;
  if not exists (select 1 from public.routines where id = p_id and revision = p_expected_revision) then
    raise exception using errcode = '40001', message = 'revision_conflict';
  end if;

  perform public.planning_validate_routine_days(p_days);
  perform public.planning_write_routine_days(p_id, p_days);
  update public.routines
  set name = btrim(p_name),
      weekly_frequency_target = p_weekly_frequency_target,
      next_workout_index = least(v_next, jsonb_array_length(p_days) - 1),
      revision = revision + 1,
      updated_at = now()
  where id = p_id;
  return p_id;
end;
$$;

create or replace function public.planning_activate_routine(p_id uuid, p_expected_revision integer)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.routines
    where id = p_id and user_id = auth.uid() and archived_at is null
  ) then
    raise exception using errcode = 'P0002', message = 'routine_not_found';
  end if;
  if not exists (select 1 from public.routines where id = p_id and revision = p_expected_revision) then
    raise exception using errcode = '40001', message = 'revision_conflict';
  end if;
  if exists (
    select 1
    from public.routine_days rd
    join public.workout_templates wt on wt.id = rd.template_id
    join public.template_exercises te on te.template_id = wt.id
    join public.exercises e on e.id = te.exercise_id
    where rd.routine_id = p_id and (wt.archived_at is not null or e.archived_at is not null)
  ) or not exists (
    select 1 from public.routine_days where routine_id = p_id
  ) or exists (
    select 1 from public.routine_days rd
    where rd.routine_id = p_id
      and (
        not exists (select 1 from public.template_exercises te where te.template_id = rd.template_id)
        or exists (
          select 1
          from public.template_exercises te
          where te.template_id = rd.template_id
            and not exists (
              select 1 from public.template_set_prescriptions tsp
              where tsp.template_exercise_id = te.id
            )
        )
      )
  ) then
    raise exception using errcode = '23514', message = 'routine_not_eligible';
  end if;

  update public.routines
  set is_active = false, revision = revision + 1, updated_at = now()
  where user_id = auth.uid() and is_active and id <> p_id;

  update public.routines
  set is_active = true, next_workout_index = 0, revision = revision + 1, updated_at = now()
  where id = p_id;
  return p_id;
end;
$$;

create or replace function public.planning_archive_routine(p_id uuid, p_expected_revision integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.routines
    where id = p_id and user_id = auth.uid() and is_active
  ) then
    raise exception using errcode = '23514', message = 'active_routine_cannot_be_archived';
  end if;

  update public.routines
  set archived_at = now(), revision = revision + 1, updated_at = now()
  where id = p_id and user_id = auth.uid() and archived_at is null and revision = p_expected_revision;
  if not found then
    if exists (select 1 from public.routines where id = p_id and user_id = auth.uid()) then
      raise exception using errcode = '40001', message = 'revision_conflict';
    end if;
    raise exception using errcode = 'P0002', message = 'routine_not_found';
  end if;
end;
$$;

revoke all on function public.planning_write_template_children(uuid, jsonb, boolean) from public;
revoke all on function public.planning_create_template(text, text, jsonb) from public;
revoke all on function public.planning_update_template(uuid, integer, text, text, jsonb) from public;
revoke all on function public.planning_duplicate_template(uuid) from public;
revoke all on function public.planning_archive_template(uuid, integer) from public;
revoke all on function public.planning_validate_routine_days(jsonb) from public;
revoke all on function public.planning_write_routine_days(uuid, jsonb) from public;
revoke all on function public.planning_create_routine(text, integer, jsonb) from public;
revoke all on function public.planning_update_routine(uuid, integer, text, integer, jsonb) from public;
revoke all on function public.planning_activate_routine(uuid, integer) from public;
revoke all on function public.planning_archive_routine(uuid, integer) from public;

grant execute on function public.planning_write_template_children(uuid, jsonb, boolean) to authenticated;
grant execute on function public.planning_create_template(text, text, jsonb) to authenticated;
grant execute on function public.planning_update_template(uuid, integer, text, text, jsonb) to authenticated;
grant execute on function public.planning_duplicate_template(uuid) to authenticated;
grant execute on function public.planning_archive_template(uuid, integer) to authenticated;
grant execute on function public.planning_validate_routine_days(jsonb) to authenticated;
grant execute on function public.planning_write_routine_days(uuid, jsonb) to authenticated;
grant execute on function public.planning_create_routine(text, integer, jsonb) to authenticated;
grant execute on function public.planning_update_routine(uuid, integer, text, integer, jsonb) to authenticated;
grant execute on function public.planning_activate_routine(uuid, integer) to authenticated;
grant execute on function public.planning_archive_routine(uuid, integer) to authenticated;
