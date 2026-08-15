begin;

select plan(19);

select has_function('public', 'progress_get_overview', ARRAY[]::text[], 'Progress overview RPC exists');
select has_function('public', 'progress_list_exercises', ARRAY['text', 'timestamp with time zone', 'uuid', 'integer'], 'Progress exercise list RPC exists');
select has_function('public', 'progress_get_exercise_detail', ARRAY['uuid', 'timestamp with time zone', 'timestamp with time zone', 'integer'], 'Exercise Progress detail RPC exists');
select has_function('public', 'progress_list_session_records', ARRAY['uuid'], 'Session PR RPC exists');

do $$
declare
  v_user uuid := '31313131-3131-4131-8131-313131313131';
  v_other uuid := '32323232-3232-4232-8232-323232323232';
  v_device uuid := '33333333-3333-4333-8333-333333333333';
  v_session uuid;
  v_session_exercise uuid;
begin
  insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at) values
    (v_user, 'authenticated', 'authenticated', 'progress@example.test', 'x', now()),
    (v_other, 'authenticated', 'authenticated', 'progress-other@example.test', 'x', now());
  insert into public.devices(id, user_id, label) values (v_device, v_user, 'Progress test');

  for v_session, v_session_exercise in
    select * from (values
      ('34343434-3434-4434-8434-343434343434'::uuid, '35353535-3535-4535-8535-353535353535'::uuid),
      ('36363636-3636-4636-8636-363636363636'::uuid, '37373737-3737-4737-8737-373737373737'::uuid)
    ) ids
  loop
    insert into public.workout_sessions(id, user_id, owner_device_id, source_type, template_name_snapshot, status, started_at, completed_at)
    values (v_session, v_user, v_device, 'AD_HOC', 'Bench test', 'COMPLETED', now() - interval '3 days', case when v_session = '34343434-3434-4434-8434-343434343434' then now() - interval '2 days' else now() - interval '1 day' end);
    insert into public.workout_session_exercises(id, session_id, source_exercise_id, sequence_no, exercise_name_snapshot, equipment_code_snapshot)
    values (v_session_exercise, v_session, '00000000-0000-0000-0000-000000000001', 1, 'Bench Snapshot', 'barbell');
  end loop;

  insert into public.workout_session_sets(id, session_exercise_id, sequence_no, set_kind_code, target_rest_seconds, actual_weight_value, actual_weight_unit, actual_weight_kg, actual_reps, status, completed_at) values
    ('38383838-3838-4838-8838-383838383838', '35353535-3535-4535-8535-353535353535', 1, 'WORKING', 90, 60, 'KG', 60, 10, 'COMPLETED', now() - interval '2 days'),
    ('39393939-3939-4939-8939-393939393939', '37373737-3737-4737-8737-373737373737', 1, 'WORKING', 90, 60, 'KG', 60, 10, 'COMPLETED', now() - interval '1 day'),
    ('40404040-4040-4040-8040-404040404040', '37373737-3737-4737-8737-373737373737', 2, 'WORKING', 90, 70, 'KG', 70, 5, 'COMPLETED', now() - interval '1 day'),
    ('41414141-4141-4141-8141-414141414141', '37373737-3737-4737-8737-373737373737', 3, 'WARM_UP', 30, 100, 'KG', 100, 1, 'COMPLETED', now() - interval '1 day'),
    ('42424242-4242-4242-8242-424242424242', '37373737-3737-4737-8737-373737373737', 4, 'DROP', 30, 90, 'KG', 90, 3, 'COMPLETED', now() - interval '1 day'),
    ('43434343-4343-4343-8343-434343434343', '37373737-3737-4737-8737-373737373737', 5, 'WORKING', 30, 95, 'KG', 95, 2, 'COMPLETED', now() - interval '1 day');
  update public.workout_session_sets set is_to_failure = true where id = '43434343-4343-4343-8343-434343434343';

  insert into public.workout_sessions(id, user_id, owner_device_id, source_type, status, started_at, completed_at)
  values ('44444444-4444-4444-8444-444444444444', v_user, v_device, 'AD_HOC', 'COMPLETED', now() - interval '13 hours', now() - interval '12 hours');
  insert into public.workout_session_exercises(id, session_id, source_exercise_id, sequence_no, exercise_name_snapshot, equipment_code_snapshot)
  values ('45454545-4545-4545-8545-454545454545', '44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000000006', 1, 'Pull-Up Snapshot', 'bodyweight');
  insert into public.workout_session_sets(id, session_exercise_id, sequence_no, set_kind_code, target_rest_seconds, actual_weight_value, actual_weight_unit, actual_weight_kg, actual_reps, status, completed_at)
  values ('46464646-4646-4646-8646-464646464646', '45454545-4545-4545-8545-454545454545', 1, 'WORKING', 90, 0, 'KG', 0, 10, 'COMPLETED', now() - interval '12 hours');
end;
$$;

select set_config('request.jwt.claim.sub', '31313131-3131-4131-8131-313131313131', true);
set local role authenticated;

select is((public.progress_get_overview()->'stats'->>'tracked_exercise_count')::int, 2, 'Overview tracks Exercises with eligible sets');
select is((public.progress_get_overview()->'stats'->>'recent_session_count')::int, 3, 'Overview counts recent eligible Sessions');
select is((select count(*)::int from jsonb_array_elements(public.progress_list_exercises(null, null, null, 20)->'items')), 2, 'Exercise list returns tracked Exercises');
select is((public.progress_get_exercise_detail('00000000-0000-0000-0000-000000000001', null, null, 250)->'metrics'->>'best_weight_kg')::numeric, 70::numeric, 'Best weight excludes warm-up, drop and failure Sets');
select is((public.progress_get_exercise_detail('00000000-0000-0000-0000-000000000001', null, null, 250)->'metrics'->>'total_volume_kg')::numeric, 1550::numeric, 'Volume uses canonical Working Set kilograms');
select is((public.progress_get_exercise_detail('00000000-0000-0000-0000-000000000006', null, null, 250)->'metrics'->>'best_estimated_1rm_kg')::numeric, null::numeric, 'Bodyweight zero has no e1RM');
select is((public.progress_get_exercise_detail('00000000-0000-0000-0000-000000000006', null, null, 250)->'metrics'->>'best_reps')::int, 10, 'Bodyweight uses reps metric');
select is((select count(*)::int from jsonb_array_elements(public.progress_list_session_records('34343434-3434-4434-8434-343434343434')->'records')), 3, 'First eligible performance establishes three record categories');
select is((select count(*)::int from jsonb_array_elements(public.progress_list_session_records('36363636-3636-4636-8636-363636363636')->'records')), 3, 'Tie at 60 kg is ignored while weight, e1RM and the first 70 kg reps record are created');
select is((select count(*)::int from jsonb_array_elements(public.progress_list_session_records('44444444-4444-4444-8444-444444444444')->'records')), 1, 'Bodyweight creates only reps-at-weight PR');

set local role postgres;
update public.workout_session_sets set actual_weight_value = 65, actual_weight_kg = 65 where id = '38383838-3838-4838-8838-383838383838';
update public.workout_sessions set edited_at = now() where id = '34343434-3434-4434-8434-343434343434';
update public.workout_sessions set deleted_at = now() where id = '36363636-3636-4636-8636-363636363636';
set local role authenticated;
select is((public.progress_get_exercise_detail('00000000-0000-0000-0000-000000000001', null, null, 250)->'metrics'->>'best_weight_kg')::numeric, 65::numeric, 'Retrospective edit changes live Progress without a metrics cache');
select is((select count(*)::int from jsonb_array_elements(public.progress_list_session_records('36363636-3636-4636-8636-363636363636')->'records')), 0, 'Soft delete removes a Session from the PR chain immediately');

select set_config('request.jwt.claim.sub', '32323232-3232-4232-8232-323232323232', true);
select is((public.progress_get_overview()->'stats'->>'tracked_exercise_count')::int, 0, 'Progress RPC isolates users');
select is(public.progress_get_exercise_detail('00000000-0000-0000-0000-000000000001', null, null, 250), null::jsonb, 'Other user cannot deep-link another user Progress');
select is((select count(*)::int from jsonb_array_elements(public.progress_list_session_records('34343434-3434-4434-8434-343434343434')->'records')), 0, 'Other user cannot read Session PR');

select * from finish();
rollback;
