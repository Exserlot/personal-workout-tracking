begin;

select plan(23);

select has_table('public', 'progress_source_state', 'Progress source state table exists');
select has_index('public', 'workout_sessions', 'workout_sessions_history_cursor_idx', 'History cursor index exists');
select has_function('public', 'history_list_sessions', ARRAY['timestamp with time zone', 'timestamp with time zone', 'timestamp with time zone', 'uuid', 'integer'], 'History list RPC exists');
select has_function('public', 'history_update_session', ARRAY['uuid', 'uuid', 'integer', 'jsonb'], 'History update RPC exists');
select has_function('public', 'history_soft_delete_session', ARRAY['uuid', 'uuid', 'integer'], 'History delete RPC exists');

do $$
declare
  v_user uuid := '12121212-1212-4212-8212-121212121212';
  v_device uuid := '13131313-1313-4313-8313-131313131313';
  v_session uuid := '14141414-1414-4414-8414-141414141414';
  v_exercise uuid := '15151515-1515-4515-8515-151515151515';
  v_set uuid := '16161616-1616-4616-8616-161616161616';
begin
  insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at)
  values (v_user, 'authenticated', 'authenticated', 'history-test@example.test', 'not-a-password', now())
  on conflict (id) do nothing;
  insert into public.devices(id, user_id, label) values (v_device, v_user, 'History test');
  insert into public.workout_sessions(id, user_id, owner_device_id, source_type, template_name_snapshot, status, started_at, completed_at, notes)
  values (v_session, v_user, v_device, 'AD_HOC', 'History Session', 'COMPLETED', '2026-08-10 10:00:00+00', '2026-08-10 11:00:00+00', 'before');
  insert into public.workout_session_exercises(id, session_id, source_exercise_id, sequence_no, exercise_name_snapshot, equipment_code_snapshot)
  select v_exercise, v_session, e.id, 1, e.name, e.equipment_code from public.exercises e where e.id = '00000000-0000-0000-0000-000000000001';
  insert into public.workout_session_exercise_muscles(session_exercise_id, role, sequence_no, source_muscle_id, muscle_name_snapshot)
  select v_exercise, 'PRIMARY', 1, m.id, m.name from public.exercises e join public.muscles m on m.id = e.primary_muscle_id where e.id = '00000000-0000-0000-0000-000000000001';
  insert into public.workout_session_sets(id, session_exercise_id, sequence_no, set_kind_code, target_reps_min, target_reps_max, target_rest_seconds, actual_weight_value, actual_weight_unit, actual_weight_kg, actual_reps, actual_effort_metric, actual_effort_value, status, completed_at)
  values (v_set, v_exercise, 1, 'WORKING', 8, 10, 90, 70, 'KG', 70, 8, 'RPE', 8, 'COMPLETED', '2026-08-10 10:10:00+00');
end;
$$;

select set_config('request.jwt.claim.sub', '12121212-1212-4212-8212-121212121212', true);
set local role authenticated;

select is((select count(*)::int from public.history_list_sessions(null, null, null, null, 20)), 1, 'Owner sees one completed History Session');
select is((select label from public.history_list_sessions(null, null, null, null, 20)), 'History Session', 'History list returns snapshot label');
select is((select duration_seconds from public.history_list_sessions(null, null, null, null, 20)), 3600, 'History list returns duration');
select is((select completed_working_set_count from public.history_list_sessions(null, null, null, null, 20)), 1, 'History list counts completed working Sets');
select is((select volume_kg from public.history_list_sessions(null, null, null, null, 20)), 560::numeric, 'History list calculates canonical volume');

select is(
  public.history_update_session(
    '17171717-1717-4717-8717-171717171717',
    '14141414-1414-4414-8414-141414141414',
    1,
    jsonb_build_object(
      'notes', 'after',
      'exercises', jsonb_build_array(jsonb_build_object(
        'id', '15151515-1515-4515-8515-151515151515',
        'source_exercise_id', '00000000-0000-0000-0000-000000000001',
        'sequence_no', 1,
        'notes', 'edited cue',
        'sets', jsonb_build_array(jsonb_build_object(
          'id', '16161616-1616-4616-8616-161616161616', 'sequence_no', 1, 'set_kind_code', 'WORKING', 'is_to_failure', false,
          'target_reps_min', 8, 'target_reps_max', 10, 'target_rest_seconds', 90,
          'actual_weight_value', 72.5, 'actual_weight_unit', 'KG', 'actual_weight_kg', 72.5, 'actual_reps', 9, 'actual_effort_metric', 'RPE', 'actual_effort_value', 8, 'status', 'COMPLETED', 'completed_at', '2026-08-10 10:10:00+00', 'notes', ''
        ))
      ))
    )
  ),
  2,
  'History update increments Session version'
);
select is((select notes from public.workout_sessions where id = '14141414-1414-4414-8414-141414141414'), 'after', 'History update changes Session notes');
select is((select actual_reps from public.workout_session_sets where id = '16161616-1616-4616-8616-161616161616'), 9, 'History update changes Set values');
select is(public.history_update_session('17171717-1717-4717-8717-171717171717', '14141414-1414-4414-8414-141414141414', 1, jsonb_build_object('notes', 'after', 'exercises', jsonb_build_array(jsonb_build_object('id', '15151515-1515-4515-8515-151515151515', 'source_exercise_id', '00000000-0000-0000-0000-000000000001', 'sequence_no', 1, 'notes', 'edited cue', 'sets', jsonb_build_array(jsonb_build_object('id', '16161616-1616-4616-8616-161616161616', 'sequence_no', 1, 'set_kind_code', 'WORKING', 'is_to_failure', false, 'target_reps_min', 8, 'target_reps_max', 10, 'target_rest_seconds', 90, 'actual_weight_value', 72.5, 'actual_weight_unit', 'KG', 'actual_weight_kg', 72.5, 'actual_reps', 9, 'actual_effort_metric', 'RPE', 'actual_effort_value', 8, 'status', 'COMPLETED', 'completed_at', '2026-08-10 10:10:00+00', 'notes', '')))))), 2, 'History update retry is idempotent');
select throws_ok(
  $$select public.history_update_session('18181818-1818-4818-8818-181818181818', '14141414-1414-4414-8414-141414141414', 1, jsonb_build_object('notes', 'stale', 'exercises', jsonb_build_array()))$$,
  'revision_conflict',
  'Stale History update is rejected'
);
select throws_ok(
  $$select public.history_update_session('17171717-1717-4717-8717-171717171717', '14141414-1414-4414-8414-141414141414', 2, jsonb_build_object('notes', 'different', 'exercises', jsonb_build_array()))$$,
  'operation_id_conflict',
  'History operation payload mismatch is rejected'
);
select is((select revision::int from public.progress_source_state where user_id = '12121212-1212-4212-8212-121212121212'), 1, 'History edit invalidates progress source once');
select is(public.history_soft_delete_session('19191919-1919-4919-8919-191919191919', '14141414-1414-4414-8414-141414141414', 2), 3, 'History soft delete increments version');
select is((select count(*)::int from public.history_list_sessions(null, null, null, null, 20)), 0, 'Soft-deleted Session disappears from History');
select is((select revision::int from public.progress_source_state where user_id = '12121212-1212-4212-8212-121212121212'), 2, 'History delete invalidates progress source once');
set local role postgres;
select is((select count(*)::int from public.mutation_receipts where aggregate_id = '14141414-1414-4414-8414-141414141414' and aggregate_type = 'WORKOUT_HISTORY'), 2, 'History update and delete each create one receipt');
set local role authenticated;

select set_config('request.jwt.claim.sub', 'abababab-abab-abab-abab-abababababab', true);
select is((select count(*)::int from public.history_list_sessions(null, null, null, null, 20)), 0, 'A different user cannot see another user History');
select throws_ok(
  $$select public.history_soft_delete_session('20202020-2020-4020-8020-202020202020', '14141414-1414-4414-8414-141414141414', 3)$$,
  'session_not_found',
  'A different user cannot mutate History'
);

select * from finish();
rollback;
