begin;

select plan(38);

select has_table('public', 'mutation_receipts', 'Mutation receipts table exists');
select col_is_pk('public', 'mutation_receipts', 'operation_id', 'Operation ID is the receipt key');
select col_not_null('public', 'mutation_receipts', 'request_hash', 'Receipt stores the request hash');
select has_function('public', 'workout_apply_command_idempotent', ARRAY['uuid', 'uuid', 'uuid', 'integer', 'jsonb'], 'Idempotent command RPC exists');

do $$
declare
  v_user uuid := 'abababab-abab-abab-abab-abababababab';
  v_exercise uuid := '00000000-0000-0000-0000-000000000001';
  v_template uuid := 'bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc';
  v_template_exercise uuid := 'cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd';
begin
  insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at)
  values (v_user, 'authenticated', 'authenticated', 'sync-test@example.test', 'not-a-password', now())
  on conflict (id) do nothing;
  insert into public.workout_templates(id, user_id, name, notes)
  values (v_template, v_user, 'Sync Template', '')
  on conflict (id) do nothing;
  insert into public.template_exercises(id, template_id, exercise_id, sequence_no, notes)
  values (v_template_exercise, v_template, v_exercise, 1, '')
  on conflict (id) do nothing;
  insert into public.template_set_prescriptions(id, template_exercise_id, sequence_no, target_reps_min, target_reps_max, target_weight_value, target_weight_unit, target_weight_kg, target_rest_seconds)
  values ('dededede-dede-dede-dede-dededededede', v_template_exercise, 1, 8, 12, 70, 'KG', 70, 90)
  on conflict (id) do nothing;
end;
$$;

select set_config('request.jwt.claim.sub', 'abababab-abab-abab-abab-abababababab', true);
set local role authenticated;

select is(
  public.workout_register_device('11111111-1111-1111-1111-111111111112', 'Sync test')::text,
  '11111111-1111-1111-1111-111111111112',
  'Sync test device can register'
);

select is(
  public.workout_start_adhoc('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111112', 'bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc', 1, 'Sync test')::text,
  '22222222-2222-2222-2222-222222222223',
  'Sync test session starts online'
);

select is(
  public.workout_apply_command_idempotent(
    '33333333-3333-3333-3333-333333333334',
    '22222222-2222-2222-2222-222222222223',
    '11111111-1111-1111-1111-111111111112',
    1,
    jsonb_build_object('action', 'complete_set', 'set_id', (select id::text from public.workout_session_sets where session_exercise_id = (select id from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222223')), 'actual_weight_value', 72.5, 'actual_weight_unit', 'KG', 'actual_reps', 8, 'actual_effort_metric', 'RPE', 'actual_effort_value', 8.5)
  ),
  2,
  'First Complete Set returns the new version'
);

select is(
  public.workout_apply_command_idempotent(
    '33333333-3333-3333-3333-333333333334',
    '22222222-2222-2222-2222-222222222223',
    '11111111-1111-1111-1111-111111111112',
    1,
    jsonb_build_object('action', 'complete_set', 'set_id', (select id::text from public.workout_session_sets where session_exercise_id = (select id from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222223')), 'actual_weight_value', 72.5, 'actual_weight_unit', 'KG', 'actual_reps', 8, 'actual_effort_metric', 'RPE', 'actual_effort_value', 8.5)
  ),
  2,
  'Retry returns the original version'
);

select is((select version from public.workout_sessions where id = '22222222-2222-2222-2222-222222222223'), 2, 'Retry does not increment Session twice');
set local role postgres;
select is((select count(*)::int from public.mutation_receipts where operation_id = '33333333-3333-3333-3333-333333333334'), 1, 'Exactly one receipt exists');
set local role authenticated;
select is((select status from public.workout_session_sets where session_exercise_id = (select id from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222223')), 'COMPLETED', 'Set is completed once');

select throws_ok(
  $$select public.workout_apply_command_idempotent('33333333-3333-3333-3333-333333333334', '22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111112', 1, jsonb_build_object('action','complete_set','set_id',(select id::text from public.workout_session_sets where session_exercise_id = (select id from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222223')),'actual_weight_value',72.5,'actual_weight_unit','KG','actual_reps',9,'actual_effort_metric','RPE','actual_effort_value',8.5))$$,
  'operation_id_conflict',
  'Reusing an operation ID with different data is rejected'
);

select throws_ok(
  $$select public.workout_apply_command_idempotent('44444444-4444-4444-4444-444444444445', '22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111112', 1, jsonb_build_object('action','complete_set','set_id',(select id::text from public.workout_session_sets where session_exercise_id = (select id from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222223')),'actual_weight_value',72.5,'actual_weight_unit','KG','actual_reps',8))$$,
  'revision_conflict',
  'A new stale operation is rejected without a receipt'
);

set local role postgres;
select is((select count(*)::int from public.mutation_receipts where aggregate_id = '22222222-2222-2222-2222-222222222223'), 1, 'Stale operation does not create a receipt');
set local role authenticated;

select is(
  public.workout_apply_command_idempotent(
    '55555555-5555-4555-8555-555555555555',
    '22222222-2222-2222-2222-222222222223',
    '11111111-1111-1111-1111-111111111112',
    2,
    jsonb_build_object('action','add_set','session_exercise_id',(select id::text from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222223'),'set_id','66666666-6666-4666-8666-666666666666','sequence_no',2,'set_kind_code','WORKING','target_reps_min',8,'target_reps_max',10,'target_rest_seconds',90)
  ),
  3,
  'Add Set returns the next version'
);
select is(
  public.workout_apply_command_idempotent('55555555-5555-4555-8555-555555555555','22222222-2222-2222-2222-222222222223','11111111-1111-1111-1111-111111111112',2,jsonb_build_object('action','add_set','session_exercise_id',(select id::text from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222223'),'set_id','66666666-6666-4666-8666-666666666666','sequence_no',2,'set_kind_code','WORKING','target_reps_min',8,'target_reps_max',10,'target_rest_seconds',90)),
  3,
  'Add Set retry returns the original version'
);
select is((select count(*)::int from public.workout_session_sets where session_exercise_id = (select id from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222223')), 2, 'Add Set retry does not duplicate the Set');

select is(
  public.workout_apply_command_idempotent('77777777-7777-4777-8777-777777777777','22222222-2222-2222-2222-222222222223','11111111-1111-1111-1111-111111111112',3,jsonb_build_object('action','edit_set','set_id',(select id::text from public.workout_session_sets where source_template_set_id is not null and session_exercise_id = (select id from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222223')),'actual_weight_value',75,'actual_weight_unit','KG','actual_reps',9,'actual_effort_metric','RIR','actual_effort_value',2)),
  4,
  'Edit Set returns the next version'
);
select is(
  public.workout_apply_command_idempotent('77777777-7777-4777-8777-777777777777','22222222-2222-2222-2222-222222222223','11111111-1111-1111-1111-111111111112',3,jsonb_build_object('action','edit_set','set_id',(select id::text from public.workout_session_sets where source_template_set_id is not null and session_exercise_id = (select id from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222223')),'actual_weight_value',75,'actual_weight_unit','KG','actual_reps',9,'actual_effort_metric','RIR','actual_effort_value',2)),
  4,
  'Edit Set retry returns the original version'
);
select is((select actual_reps from public.workout_session_sets where source_template_set_id is not null and session_exercise_id = (select id from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222223')), 9, 'Edit Set persists the latest values once');

select is(
  public.workout_apply_command_idempotent('88888888-8888-4888-8888-888888888888','22222222-2222-2222-2222-222222222223','11111111-1111-1111-1111-111111111112',4,jsonb_build_object('action','skip_set','set_id','66666666-6666-4666-8666-666666666666')),
  5,
  'Skip Set returns the next version'
);
select is(
  public.workout_apply_command_idempotent('88888888-8888-4888-8888-888888888888','22222222-2222-2222-2222-222222222223','11111111-1111-1111-1111-111111111112',4,jsonb_build_object('action','skip_set','set_id','66666666-6666-4666-8666-666666666666')),
  5,
  'Skip Set retry returns the original version'
);
select is((select status from public.workout_session_sets where id = '66666666-6666-4666-8666-666666666666'), 'SKIPPED', 'Skip Set is applied once');

select is(
  public.workout_apply_command_idempotent('99999999-9999-4999-8999-999999999999','22222222-2222-2222-2222-222222222223','11111111-1111-1111-1111-111111111112',5,jsonb_build_object('action','delete_set','set_id','66666666-6666-4666-8666-666666666666')),
  6,
  'Delete Set returns the next version'
);
select is(
  public.workout_apply_command_idempotent('99999999-9999-4999-8999-999999999999','22222222-2222-2222-2222-222222222223','11111111-1111-1111-1111-111111111112',5,jsonb_build_object('action','delete_set','set_id','66666666-6666-4666-8666-666666666666')),
  6,
  'Delete Set retry returns the original version'
);
select is((select count(*)::int from public.workout_session_sets where session_exercise_id = (select id from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222223')), 1, 'Delete Set retry does not delete another Set');
select is((select version from public.workout_sessions where id = '22222222-2222-2222-2222-222222222223'), 6, 'Four additional mutations increment Session version once each');

select is(
  public.workout_apply_command_idempotent('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-2222-2222-222222222223','11111111-1111-1111-1111-111111111112',6,jsonb_build_object('action','finish_session')),
  7,
  'Finish lifecycle returns the terminal version'
);
select is(
  public.workout_apply_command_idempotent('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-2222-2222-222222222223','11111111-1111-1111-1111-111111111112',6,jsonb_build_object('action','finish_session')),
  7,
  'Finish retry returns the original terminal version'
);
select is((select status from public.workout_sessions where id = '22222222-2222-2222-2222-222222222223'), 'COMPLETED', 'Finish closes the Session once');
set local role postgres;
select is((select count(*)::int from public.mutation_receipts where operation_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'), 1, 'Finish creates one receipt');
set local role authenticated;
select throws_ok(
  $$select public.workout_apply_command_idempotent('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-2222-2222-222222222223','11111111-1111-1111-1111-111111111112',7,jsonb_build_object('action','discard_session'))$$,
  'session_not_active',
  'A new Discard after Finish is rejected'
);
select throws_ok(
  $$select public.workout_apply_command_idempotent('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','22222222-2222-2222-2222-222222222223','11111111-1111-1111-1111-111111111112',7,jsonb_build_object('action','finish_session'))$$,
  'session_not_active',
  'A new Finish after Finish is rejected'
);
select is((select version from public.workout_sessions where id = '22222222-2222-2222-2222-222222222223'), 7, 'Terminal retries do not increment Session twice');

select throws_ok(
  $$select public.workout_apply_command_idempotent('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222223','11111111-1111-1111-1111-111111111112',6,jsonb_build_object('action','move_set','set_id',(select id::text from public.workout_session_sets where session_exercise_id = (select id from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222223')),'sequence_no',1))$$,
  'offline_command_not_supported',
  'Set reorder is not accepted by the offline RPC'
);
select throws_ok(
  $$select public.workout_apply_command_idempotent('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222223','12121212-1212-4212-8212-121212121212',6,jsonb_build_object('action','edit_set','set_id',(select id::text from public.workout_session_sets where session_exercise_id = (select id from public.workout_session_exercises where session_id = '22222222-2222-2222-2222-222222222223')),'actual_weight_value',75,'actual_weight_unit','KG','actual_reps',9))$$,
  'device_not_owned',
  'A non-owner device cannot apply an idempotent Set mutation'
);
set local role postgres;
select is((select count(*)::int from public.mutation_receipts where operation_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'Rejected non-owner mutation creates no receipt');
set local role authenticated;
select throws_ok($$select * from public.mutation_receipts$$, '42501', 'permission denied for table mutation_receipts', 'Browser roles cannot read mutation receipts directly');

select * from finish();
rollback;
