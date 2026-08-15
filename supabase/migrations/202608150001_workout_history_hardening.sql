-- M-05A.1: preserve immutable history snapshots while allowing safe retrospective edits.
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
  v_old_exercise public.workout_session_exercises%rowtype;
  v_old_set public.workout_session_sets%rowtype;
  v_exercise_row public.exercises%rowtype;
  v_exercise jsonb;
  v_set jsonb;
  v_exercise_id uuid;
  v_set_id uuid;
  v_source_exercise_id uuid;
  v_hash text;
  v_version integer;
  v_sequence integer;
  v_set_sequence integer;
  v_kind text;
  v_status text;
  v_weight numeric;
  v_unit text;
  v_kg numeric;
  v_reps integer;
  v_metric text;
  v_effort numeric;
  v_rest integer;
  v_completed_at timestamptz;
  v_replaced boolean;
  v_seen_exercises uuid[] := '{}'::uuid[];
  v_seen_sets uuid[] := '{}'::uuid[];
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

  -- Move rows out of the unique sequence range before applying a reorder.
  update public.workout_session_exercises set sequence_no = sequence_no + 100000 where session_id = p_session_id;
  update public.workout_session_sets set sequence_no = sequence_no + 100000
    where session_exercise_id in (select id from public.workout_session_exercises where session_id = p_session_id);

  for v_exercise in select value from jsonb_array_elements(p_draft->'exercises') loop
    v_exercise_id := nullif(v_exercise->>'id', '')::uuid;
    v_source_exercise_id := nullif(v_exercise->>'source_exercise_id', '')::uuid;
    v_sequence := nullif(v_exercise->>'sequence_no', '')::integer;
    if v_sequence is null or v_sequence <> coalesce(array_length(v_seen_exercises, 1), 0) + 1 then raise exception using errcode = '23514', message = 'invalid_exercise_sequence'; end if;
    if v_exercise_id is not null then
      select * into v_old_exercise from public.workout_session_exercises where id = v_exercise_id and session_id = p_session_id for update;
      if not found or v_exercise_id = any(v_seen_exercises) then raise exception using errcode = '22023', message = 'duplicate_or_unknown_exercise'; end if;
      v_replaced := v_old_exercise.source_exercise_id is distinct from v_source_exercise_id;
      if v_source_exercise_id is null and v_replaced then raise exception using errcode = '22023', message = 'exercise_source_required'; end if;
      if v_replaced then
        select * into v_exercise_row from public.exercises where id = v_source_exercise_id and archived_at is null and (owner_user_id is null or owner_user_id = auth.uid());
        if not found then raise exception using errcode = 'P0002', message = 'exercise_not_found'; end if;
        update public.workout_session_exercises set source_template_exercise_id = null, source_exercise_id = v_source_exercise_id, sequence_no = v_sequence, exercise_name_snapshot = v_exercise_row.name, equipment_code_snapshot = v_exercise_row.equipment_code, notes = left(coalesce(v_exercise->>'notes', ''), 1000) where id = v_exercise_id;
        delete from public.workout_session_exercise_muscles where session_exercise_id = v_exercise_id;
        insert into public.workout_session_exercise_muscles(session_exercise_id, role, sequence_no, source_muscle_id, muscle_name_snapshot)
          select v_exercise_id, 'PRIMARY', 1, m.id, m.name from public.muscles m where m.id = v_exercise_row.primary_muscle_id;
        insert into public.workout_session_exercise_muscles(session_exercise_id, role, sequence_no, source_muscle_id, muscle_name_snapshot)
          select v_exercise_id, 'SECONDARY', esm.sequence_no, esm.muscle_id, m.name from public.exercise_secondary_muscles esm join public.muscles m on m.id = esm.muscle_id where esm.exercise_id = v_source_exercise_id order by esm.sequence_no;
        update public.workout_session_sets set source_template_set_id = null where session_exercise_id = v_exercise_id;
      else
        update public.workout_session_exercises set sequence_no = v_sequence, notes = left(coalesce(v_exercise->>'notes', ''), 1000) where id = v_exercise_id;
      end if;
    else
      if v_source_exercise_id is null then raise exception using errcode = '22023', message = 'exercise_source_required'; end if;
      select * into v_exercise_row from public.exercises where id = v_source_exercise_id and archived_at is null and (owner_user_id is null or owner_user_id = auth.uid());
      if not found then raise exception using errcode = 'P0002', message = 'exercise_not_found'; end if;
      v_exercise_id := gen_random_uuid();
      insert into public.workout_session_exercises(id, session_id, source_template_exercise_id, source_exercise_id, sequence_no, exercise_name_snapshot, equipment_code_snapshot, notes)
        values(v_exercise_id, p_session_id, null, v_source_exercise_id, v_sequence, v_exercise_row.name, v_exercise_row.equipment_code, left(coalesce(v_exercise->>'notes', ''), 1000));
      insert into public.workout_session_exercise_muscles(session_exercise_id, role, sequence_no, source_muscle_id, muscle_name_snapshot)
        select v_exercise_id, 'PRIMARY', 1, m.id, m.name from public.muscles m where m.id = v_exercise_row.primary_muscle_id;
      insert into public.workout_session_exercise_muscles(session_exercise_id, role, sequence_no, source_muscle_id, muscle_name_snapshot)
        select v_exercise_id, 'SECONDARY', esm.sequence_no, esm.muscle_id, m.name from public.exercise_secondary_muscles esm join public.muscles m on m.id = esm.muscle_id where esm.exercise_id = v_source_exercise_id order by esm.sequence_no;
      v_replaced := true;
    end if;
    v_seen_exercises := array_append(v_seen_exercises, v_exercise_id);
    if jsonb_typeof(v_exercise->'sets') <> 'array' or jsonb_array_length(v_exercise->'sets') < 1 then raise exception using errcode = '23514', message = 'exercise_requires_set'; end if;
    v_set_sequence := 0;
    for v_set in select value from jsonb_array_elements(v_exercise->'sets') loop
      v_set_sequence := v_set_sequence + 1;
      v_set_id := nullif(v_set->>'id', '')::uuid;
      v_kind := coalesce(v_set->>'set_kind_code', 'WORKING');
      v_status := coalesce(v_set->>'status', 'PENDING');
      if v_kind not in ('WORKING','WARM_UP','DROP') or v_status not in ('PENDING','COMPLETED','SKIPPED') then raise exception using errcode = '22023', message = 'invalid_set_type'; end if;
      if v_set_id is not null then
        select * into v_old_set from public.workout_session_sets where id = v_set_id and session_exercise_id = v_exercise_id for update;
        if not found or v_set_id = any(v_seen_sets) then raise exception using errcode = '22023', message = 'duplicate_or_unknown_set'; end if;
      else
        v_old_set := null;
      end if;
      v_weight := nullif(v_set->>'actual_weight_value', '')::numeric;
      v_unit := nullif(v_set->>'actual_weight_unit', '');
      v_reps := nullif(v_set->>'actual_reps', '')::integer;
      v_metric := nullif(v_set->>'actual_effort_metric', '');
      v_effort := nullif(v_set->>'actual_effort_value', '')::numeric;
      v_rest := nullif(v_set->>'actual_rest_seconds', '')::integer;
      if v_status = 'COMPLETED' then
        if v_weight is null or v_weight < 0 or v_unit not in ('KG','LB') or v_reps is null or v_reps < 1 then raise exception using errcode = '23514', message = 'completed_set_requires_values'; end if;
        v_kg := round(case when v_unit = 'LB' then v_weight * 0.45359237 else v_weight end, 4);
        if v_metric is not null and not ((v_metric = 'RPE' and v_effort between 1 and 10 and mod(v_effort * 2, 1) = 0) or (v_metric = 'RIR' and v_effort between 0 and 10 and mod(v_effort, 1) = 0)) then raise exception using errcode = '23514', message = 'invalid_effort'; end if;
        if v_old_set.id is not null and v_old_set.status = 'COMPLETED' then v_completed_at := v_old_set.completed_at; else v_completed_at := now(); end if;
      else
        v_weight := null; v_unit := null; v_kg := null; v_reps := null; v_metric := null; v_effort := null; v_rest := null; v_completed_at := null;
      end if;
      if v_set_id is null then
        if v_kind = 'DROP' then raise exception using errcode = '22023', message = 'new_drop_set_not_allowed'; end if;
        v_set_id := gen_random_uuid();
        insert into public.workout_session_sets(id, session_exercise_id, sequence_no, set_kind_code, is_to_failure, actual_weight_value, actual_weight_unit, actual_weight_kg, actual_reps, actual_effort_metric, actual_effort_value, actual_rest_seconds, status, completed_at, notes)
          values(v_set_id, v_exercise_id, v_set_sequence, v_kind, false, v_weight, v_unit, v_kg, v_reps, v_metric, v_effort, v_rest, v_status, v_completed_at, left(coalesce(v_set->>'notes',''),1000));
      else
        update public.workout_session_sets set sequence_no = v_set_sequence, set_kind_code = v_kind, actual_weight_value = v_weight, actual_weight_unit = v_unit, actual_weight_kg = v_kg, actual_reps = v_reps, actual_effort_metric = v_metric, actual_effort_value = v_effort, actual_rest_seconds = v_rest, status = v_status, completed_at = v_completed_at, notes = left(coalesce(v_set->>'notes',''),1000) where id = v_set_id;
      end if;
      v_seen_sets := array_append(v_seen_sets, v_set_id);
    end loop;
  end loop;
  delete from public.workout_session_exercises where session_id = p_session_id and not (id = any(v_seen_exercises));
  delete from public.workout_session_sets where session_exercise_id in (select id from public.workout_session_exercises where session_id = p_session_id) and not (id = any(v_seen_sets));
  update public.workout_sessions set notes = coalesce(p_draft->>'notes',''), version = version + 1, edited_at = now(), updated_at = now() where id = p_session_id;
  select version into v_version from public.workout_sessions where id = p_session_id;
  insert into public.mutation_receipts(operation_id, user_id, aggregate_type, aggregate_id, request_hash, result_version) values(p_operation_id, auth.uid(), 'WORKOUT_HISTORY', p_session_id, v_hash, v_version);
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
declare v_receipt public.mutation_receipts%rowtype; v_session public.workout_sessions%rowtype; v_hash text; v_version integer;
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
  insert into public.mutation_receipts(operation_id, user_id, aggregate_type, aggregate_id, request_hash, result_version) values(p_operation_id, auth.uid(), 'WORKOUT_HISTORY', p_session_id, v_hash, v_version);
  return v_version;
end;
$$;

revoke all on function public.history_update_session(uuid, uuid, integer, jsonb) from public, anon;
grant execute on function public.history_update_session(uuid, uuid, integer, jsonb) to authenticated;
revoke all on function public.history_soft_delete_session(uuid, uuid, integer) from public, anon;
grant execute on function public.history_soft_delete_session(uuid, uuid, integer) to authenticated;
