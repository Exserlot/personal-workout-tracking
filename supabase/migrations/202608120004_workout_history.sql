-- M-05A: completed Session History, retrospective edits and soft delete.
create index if not exists workout_sessions_history_cursor_idx
  on public.workout_sessions(user_id, completed_at desc, id desc)
  where status = 'COMPLETED' and deleted_at is null;

alter table public.mutation_receipts drop constraint if exists mutation_receipts_aggregate_type_check;
alter table public.mutation_receipts add constraint mutation_receipts_aggregate_type_check
  check (aggregate_type in ('WORKOUT_SESSION', 'WORKOUT_HISTORY'));

create table if not exists public.progress_source_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  invalidated_at timestamptz
);

alter table public.progress_source_state enable row level security;
drop policy if exists "owners read progress source state" on public.progress_source_state;
create policy "owners read progress source state" on public.progress_source_state
  for select to authenticated using (user_id = auth.uid());
revoke all on public.progress_source_state from anon, authenticated;
grant select on public.progress_source_state to authenticated;

create or replace function public.touch_progress_source_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'COMPLETED' and (
    old.status is distinct from new.status
    or old.edited_at is distinct from new.edited_at
    or old.deleted_at is distinct from new.deleted_at
  ) then
    insert into public.progress_source_state(user_id, revision, invalidated_at)
    values (new.user_id, 1, now())
    on conflict (user_id) do update
      set revision = progress_source_state.revision + 1,
          invalidated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists workout_sessions_progress_source on public.workout_sessions;
create trigger workout_sessions_progress_source
after update of status, edited_at, deleted_at on public.workout_sessions
for each row execute function public.touch_progress_source_state();

create or replace function public.history_list_sessions(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_cursor_completed_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table(
  session_id uuid,
  label text,
  source_type text,
  completed_at timestamptz,
  duration_seconds integer,
  exercise_count integer,
  completed_working_set_count integer,
  volume_kg numeric,
  edited_at timestamptz
)
language sql
security invoker
set search_path = public
as $$
  select
    ws.id,
    coalesce(ws.template_name_snapshot, 'Ad-hoc Workout'),
    ws.source_type,
    ws.completed_at,
    greatest(0, floor(extract(epoch from (ws.completed_at - ws.started_at)))::integer),
    count(distinct wse.id)::integer,
    count(wss.id) filter (where wss.status = 'COMPLETED' and wss.set_kind_code = 'WORKING')::integer,
    coalesce(sum(wss.actual_weight_kg * wss.actual_reps) filter (where wss.status = 'COMPLETED' and wss.set_kind_code = 'WORKING'), 0),
    ws.edited_at
  from public.workout_sessions ws
  left join public.workout_session_exercises wse on wse.session_id = ws.id
  left join public.workout_session_sets wss on wss.session_exercise_id = wse.id
  where ws.user_id = auth.uid()
    and ws.status = 'COMPLETED'
    and ws.deleted_at is null
    and (p_from is null or ws.completed_at >= p_from)
    and (p_to is null or ws.completed_at < p_to)
    and (p_cursor_completed_at is null or (ws.completed_at, ws.id) < (p_cursor_completed_at, p_cursor_id))
  group by ws.id
  order by ws.completed_at desc, ws.id desc
  limit greatest(1, least(coalesce(p_limit, 20) + 1, 101));
$$;

create or replace function public.history_update_session(
  p_operation_id uuid,
  p_session_id uuid,
  p_expected_version integer,
  p_draft jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.mutation_receipts%rowtype;
  v_session public.workout_sessions%rowtype;
  v_hash text;
  v_version integer;
  v_exercise jsonb;
  v_set jsonb;
  v_exercise_id uuid;
  v_set_id uuid;
  v_source_exercise_id uuid;
  v_muscle record;
  v_exercise_row public.exercises%rowtype;
  v_sequence integer;
  v_kind text;
  v_status text;
  v_actual_weight numeric;
  v_actual_unit text;
  v_actual_kg numeric;
  v_actual_reps integer;
  v_actual_metric text;
  v_actual_effort numeric;
  v_completed_at timestamptz;
  v_existing_sources uuid[];
begin
  if p_operation_id is null or p_session_id is null or p_expected_version < 1 or jsonb_typeof(p_draft) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_history_update_request';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_operation_id::text));
  v_hash := md5(concat_ws('|', p_session_id::text, p_expected_version::text, p_draft::text));
  select * into v_receipt from public.mutation_receipts where operation_id = p_operation_id;
  if found then
    if v_receipt.user_id <> auth.uid() or v_receipt.aggregate_id <> p_session_id or v_receipt.request_hash <> v_hash then
      raise exception using errcode = 'P0001', message = 'operation_id_conflict';
    end if;
    return v_receipt.result_version;
  end if;
  select * into v_session from public.workout_sessions where id = p_session_id for update;
  if not found or v_session.user_id <> auth.uid() then raise exception using errcode = 'P0002', message = 'session_not_found'; end if;
  if v_session.status <> 'COMPLETED' or v_session.deleted_at is not null then raise exception using errcode = 'P0001', message = 'history_session_not_editable'; end if;
  if v_session.version <> p_expected_version then raise exception using errcode = '40001', message = 'revision_conflict'; end if;
  if jsonb_typeof(p_draft->'exercises') <> 'array' or char_length(coalesce(p_draft->>'notes', '')) > 2000 then raise exception using errcode = '22023', message = 'invalid_history_draft'; end if;

  select coalesce(array_agg(distinct source_exercise_id), '{}'::uuid[])
    into v_existing_sources
    from public.workout_session_exercises
    where session_id = p_session_id and source_exercise_id is not null;

  update public.workout_sessions
    set notes = coalesce(p_draft->>'notes', ''), version = version + 1, edited_at = now(), updated_at = now()
    where id = p_session_id;
  delete from public.workout_session_exercises where session_id = p_session_id;

  for v_exercise in select value from jsonb_array_elements(p_draft->'exercises') loop
    v_exercise_id := coalesce(nullif(v_exercise->>'id', '')::uuid, gen_random_uuid());
    v_source_exercise_id := nullif(v_exercise->>'source_exercise_id', '')::uuid;
    if v_source_exercise_id is null then raise exception using errcode = '22023', message = 'exercise_source_required'; end if;
    select * into v_exercise_row
      from public.exercises
      where id = v_source_exercise_id
        and (owner_user_id is null or owner_user_id = auth.uid())
        and (archived_at is null or v_source_exercise_id = any(v_existing_sources));
    if not found then raise exception using errcode = 'P0002', message = 'exercise_not_found'; end if;
    v_sequence := (v_exercise->>'sequence_no')::integer;
    if v_sequence < 1 then raise exception using errcode = '23514', message = 'invalid_exercise_sequence'; end if;
    insert into public.workout_session_exercises(id, session_id, source_exercise_id, sequence_no, exercise_name_snapshot, equipment_code_snapshot, notes)
      values (v_exercise_id, p_session_id, v_source_exercise_id, v_sequence, v_exercise_row.name, v_exercise_row.equipment_code, left(coalesce(v_exercise->>'notes', ''), 1000));
    insert into public.workout_session_exercise_muscles(session_exercise_id, role, sequence_no, source_muscle_id, muscle_name_snapshot)
      select v_exercise_id, 'PRIMARY', 1, m.id, m.name from public.muscles m where m.id = v_exercise_row.primary_muscle_id;
    for v_muscle in select esm.muscle_id, m.name from public.exercise_secondary_muscles esm join public.muscles m on m.id = esm.muscle_id where esm.exercise_id = v_source_exercise_id order by esm.sequence_no loop
      insert into public.workout_session_exercise_muscles(session_exercise_id, role, sequence_no, source_muscle_id, muscle_name_snapshot)
        values (v_exercise_id, 'SECONDARY', (select count(*) + 1 from public.workout_session_exercise_muscles where session_exercise_id = v_exercise_id and role = 'SECONDARY'), v_muscle.muscle_id, v_muscle.name);
    end loop;
    if jsonb_typeof(v_exercise->'sets') <> 'array' or jsonb_array_length(v_exercise->'sets') < 1 then raise exception using errcode = '23514', message = 'exercise_requires_set'; end if;
    for v_set in select value from jsonb_array_elements(v_exercise->'sets') loop
      v_set_id := coalesce(nullif(v_set->>'id', '')::uuid, gen_random_uuid());
      v_kind := coalesce(v_set->>'set_kind_code', 'WORKING');
      v_status := coalesce(v_set->>'status', 'PENDING');
      v_actual_weight := nullif(v_set->>'actual_weight_value', '')::numeric;
      v_actual_unit := nullif(v_set->>'actual_weight_unit', '');
      v_actual_kg := nullif(v_set->>'actual_weight_kg', '')::numeric;
      v_actual_reps := nullif(v_set->>'actual_reps', '')::integer;
      v_actual_metric := nullif(v_set->>'actual_effort_metric', '');
      v_actual_effort := nullif(v_set->>'actual_effort_value', '')::numeric;
      v_completed_at := nullif(v_set->>'completed_at', '')::timestamptz;
      if v_status = 'COMPLETED' and (v_actual_weight is null or v_actual_reps is null or v_completed_at is null) then raise exception using errcode = '23514', message = 'completed_set_requires_values'; end if;
      if v_status <> 'COMPLETED' and (v_actual_weight is not null or v_actual_reps is not null or v_completed_at is not null) then raise exception using errcode = '23514', message = 'non_completed_set_has_actual_values'; end if;
      insert into public.workout_session_sets(id, session_exercise_id, source_template_set_id, sequence_no, set_kind_code, is_to_failure, target_reps_min, target_reps_max, target_weight_value, target_weight_unit, target_weight_kg, target_effort_metric, target_effort_value, target_rest_seconds, actual_weight_value, actual_weight_unit, actual_weight_kg, actual_reps, actual_effort_metric, actual_effort_value, actual_rest_seconds, status, completed_at, notes)
        values (v_set_id, v_exercise_id, nullif(v_set->>'source_template_set_id', '')::uuid, (v_set->>'sequence_no')::integer, v_kind, coalesce((v_set->>'is_to_failure')::boolean, false), nullif(v_set->>'target_reps_min', '')::integer, nullif(v_set->>'target_reps_max', '')::integer, nullif(v_set->>'target_weight_value', '')::numeric, nullif(v_set->>'target_weight_unit', ''), nullif(v_set->>'target_weight_kg', '')::numeric, nullif(v_set->>'target_effort_metric', ''), nullif(v_set->>'target_effort_value', '')::numeric, coalesce((v_set->>'target_rest_seconds')::integer, 0), v_actual_weight, v_actual_unit, v_actual_kg, v_actual_reps, v_actual_metric, v_actual_effort, nullif(v_set->>'actual_rest_seconds', '')::integer, v_status, v_completed_at, left(coalesce(v_set->>'notes', ''), 1000));
    end loop;
  end loop;

  select version into v_version from public.workout_sessions where id = p_session_id;
  insert into public.mutation_receipts(operation_id, user_id, aggregate_type, aggregate_id, request_hash, result_version)
    values (p_operation_id, auth.uid(), 'WORKOUT_HISTORY', p_session_id, v_hash, v_version);
  return v_version;
end;
$$;

create or replace function public.history_soft_delete_session(
  p_operation_id uuid,
  p_session_id uuid,
  p_expected_version integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.mutation_receipts%rowtype;
  v_session public.workout_sessions%rowtype;
  v_hash text;
  v_version integer;
begin
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
    values (p_operation_id, auth.uid(), 'WORKOUT_HISTORY', p_session_id, v_hash, v_version);
  return v_version;
end;
$$;

revoke all on function public.history_list_sessions(timestamptz, timestamptz, timestamptz, uuid, integer) from public, anon;
grant execute on function public.history_list_sessions(timestamptz, timestamptz, timestamptz, uuid, integer) to authenticated;
revoke all on function public.history_update_session(uuid, uuid, integer, jsonb) from public, anon;
grant execute on function public.history_update_session(uuid, uuid, integer, jsonb) to authenticated;
revoke all on function public.history_soft_delete_session(uuid, uuid, integer) from public, anon;
grant execute on function public.history_soft_delete_session(uuid, uuid, integer) to authenticated;
