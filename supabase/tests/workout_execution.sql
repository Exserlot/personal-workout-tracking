begin;

select plan(27);

select has_table('public', 'devices', 'Device table exists');
select has_table('public', 'workout_sessions', 'Workout Session table exists');
select has_table('public', 'workout_session_exercises', 'Session Exercise table exists');
select has_table('public', 'workout_session_exercise_muscles', 'Session muscle snapshot table exists');
select has_table('public', 'workout_session_sets', 'Session Set table exists');
select has_index('public', 'workout_sessions', 'workout_sessions_one_active_per_user', 'Single Active Session index exists');
select col_not_null('public', 'workout_sessions', 'owner_device_id', 'Active Sessions require an owner device');
select col_not_null('public', 'workout_session_sets', 'status', 'Session Sets require a status');

do $$
declare
  v_user uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_exercise uuid := '00000000-0000-0000-0000-000000000001';
  v_template uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_template_exercise uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_set uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_routine uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  v_day uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
begin
  insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at)
  values (v_user, 'authenticated', 'authenticated', 'm03-test@example.test', 'not-a-password', now())
  on conflict (id) do nothing;
  insert into public.workout_templates(id, user_id, name, notes)
  values (v_template, v_user, 'M03 Push', '')
  on conflict (id) do nothing;
  insert into public.template_exercises(id, template_id, exercise_id, sequence_no, notes)
  values (v_template_exercise, v_template, v_exercise, 1, '')
  on conflict (id) do nothing;
  insert into public.template_set_prescriptions(id, template_exercise_id, sequence_no, target_reps_min, target_reps_max, target_weight_value, target_weight_unit, target_weight_kg, target_effort_metric, target_effort_value, target_rest_seconds)
  values (v_set, v_template_exercise, 1, 8, 10, 70, 'KG', 70, 'RPE', 8, 90)
  on conflict (id) do nothing;
  insert into public.routines(id, user_id, name, weekly_frequency_target, is_active)
  values (v_routine, v_user, 'M03 Routine', 3, true)
  on conflict (id) do nothing;
  insert into public.routine_days(id, routine_id, template_id, sequence_no, label, notes)
  values (v_day, v_routine, v_template, 1, 'A', '')
  on conflict (id) do nothing;
end;
$$;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
set local role authenticated;

select is(
  public.workout_register_device('11111111-1111-1111-1111-111111111111', 'M03 test')::text,
  '11111111-1111-1111-1111-111111111111',
  'Owner device can register'
);

select is(
  public.workout_start_planned('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 1, 1)::text,
  '22222222-2222-2222-2222-222222222222',
  'Planned Start creates one Active Session'
);

select is((select count(*)::int from public.workout_sessions where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and status = 'ACTIVE'), 1, 'Only one Active Session exists');
select is((select exercise_name_snapshot from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222222'), 'Barbell Bench Press', 'Session snapshots Exercise name');
select is((select target_weight_value::numeric from public.workout_session_sets where session_exercise_id = (select id from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222222')), 70::numeric, 'Session snapshots target weight');

select throws_ok(
  $$select public.workout_start_adhoc('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', null, null, 'Blocked')$$,
  'active_session_exists',
  'Second Start is blocked while a Session is active'
);

select lives_ok(
  $$with target as (select id from public.workout_session_sets where source_template_set_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd') select public.workout_apply_command('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 1, jsonb_build_object('action','complete_set','set_id',(select id::text from target),'actual_weight_value',72.5,'actual_weight_unit','KG','actual_reps',8,'actual_effort_metric','RPE','actual_effort_value',8.5))$$,
  'Owner can complete a decimal-weight Set'
);
select is((select status from public.workout_session_sets where source_template_set_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'), 'COMPLETED', 'Completed Set status is persisted');
select is((select actual_weight_kg::numeric from public.workout_session_sets where source_template_set_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'), 72.5::numeric, 'Canonical KG is persisted');

select lives_ok(
  $$select public.workout_apply_command('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 2, jsonb_build_object('action','add_set','session_exercise_id',(select id::text from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222222'),'set_id','44444444-4444-4444-8444-444444444444','sequence_no',2,'set_kind_code','WORKING','target_reps_min',8,'target_reps_max',10,'target_rest_seconds',90))$$,
  'Owner can add a Set to an active Exercise'
);
select is((select count(*)::int from public.workout_session_sets where session_exercise_id = (select id from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222222')), 2, 'Added Set is persisted');

select lives_ok(
  $$select public.workout_apply_command('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 3, jsonb_build_object('action','move_set','set_id','44444444-4444-4444-8444-444444444444','sequence_no',1))$$,
  'Owner can reorder Sets'
);
select is((select sequence_no from public.workout_session_sets where id = '44444444-4444-4444-8444-444444444444'), 1, 'Set reorder updates sequence');

select throws_ok(
  $$select public.workout_apply_command('22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', 1, jsonb_build_object('action','skip_set','set_id',(select id::text from public.workout_session_sets where source_template_set_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd')))$$,
  'device_not_owned',
  'Unregistered device cannot mutate a Session'
);

set local role postgres;
update public.workout_templates set name = 'Changed Plan' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
set local role authenticated;
select is((select template_name_snapshot from public.workout_sessions where id = '22222222-2222-2222-2222-222222222222'), 'M03 Push', 'Template edits do not change Session snapshot');

select throws_ok(
  $$update public.routines set name = 'Blocked Routine' where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
  'active_session_blocks_routine_change',
  'Active Routine edits are blocked while a Session is active'
);

select lives_ok(
  $$select public.workout_finish_session('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 4)$$,
  'Owner can Finish the Session'
);
select is((select status from public.workout_sessions where id = '22222222-2222-2222-2222-222222222222'), 'COMPLETED', 'Finish changes Session status');
select is((select next_workout_index from public.routines where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'), 0, 'Single-day Routine wraps after completion');

select * from finish();
rollback;
