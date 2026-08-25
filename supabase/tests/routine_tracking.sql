begin;

select plan(20);

select has_table('public', 'user_preferences', 'User preferences table exists');
select has_table('public', 'routine_activation_events', 'Activation events table exists');
select has_table('public', 'routine_week_plans', 'Routine week plans table exists');
select has_table('public', 'routine_week_plan_days', 'Routine week day snapshots exist');
select has_table('public', 'weekly_routine_notifications', 'Weekly notification table exists');
select has_column('public', 'workout_sessions', 'source_routine_week_plan_id', 'Session stores week plan source');
select has_column('public', 'workout_sessions', 'source_routine_week_plan_day_id', 'Session stores week day source');

do $$
declare
  v_user uuid := '81818181-8181-4181-8181-818181818181';
  v_other uuid := '82828282-8282-4282-8282-828282828282';
  v_template uuid := '83838383-8383-4383-8383-838383838383';
  v_template_exercise uuid := '84848484-8484-4484-8484-848484848484';
  v_routine uuid := '85858585-8585-4585-8585-858585858585';
begin
  insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at) values
    (v_user, 'authenticated', 'authenticated', 'm08@example.test', 'x', now()),
    (v_other, 'authenticated', 'authenticated', 'm08-other@example.test', 'x', now());
  insert into public.workout_templates(id, user_id, name) values (v_template, v_user, 'PPL');
  insert into public.template_exercises(id, template_id, exercise_id, sequence_no)
    values (v_template_exercise, v_template, '00000000-0000-0000-0000-000000000001', 1);
  insert into public.template_set_prescriptions(template_exercise_id, sequence_no, target_reps_min, target_reps_max)
    values (v_template_exercise, 1, 8, 10);
  insert into public.routines(id, user_id, name, weekly_frequency_target)
    values (v_routine, v_user, 'Flexible PPL', 3);
  insert into public.routine_days(id, routine_id, template_id, sequence_no, label) values
    ('86111111-1111-4111-8111-111111111111', v_routine, v_template, 1, 'Push'),
    ('86222222-2222-4222-8222-222222222222', v_routine, v_template, 2, 'Pull'),
    ('86333333-3333-4333-8333-333333333333', v_routine, v_template, 3, 'Legs');
  insert into public.user_preferences(user_id, timezone) values (v_other, 'UTC');
end;
$$;

select set_config('request.jwt.claim.sub', '81818181-8181-4181-8181-818181818181', true);
set local role authenticated;

select is(public.preferences_get_or_create_timezone('Asia/Bangkok'), 'Asia/Bangkok', 'Browser timezone initializes preferences');
select throws_ok($$select public.preferences_update_timezone('Mars/Olympus')$$, 'invalid_timezone', 'Invalid IANA timezone is rejected');

select lives_ok(
  $$select public.planning_activate_routine(
    '85858585-8585-4585-8585-858585858585', 1,
    (now() at time zone 'Asia/Bangkok')::date - (extract(isodow from (now() at time zone 'Asia/Bangkok'))::integer - 1)
  )$$,
  'Routine can activate for current week'
);
select is((select count(*)::integer from public.routine_week_plans), 1, 'Current week materializes once');
select is((select count(*)::integer from public.routine_week_plan_days), 3, 'All coverage identities are snapshotted');
select is((select locked_at is null from public.routine_week_plans limit 1), true, 'Plan is unlocked before first Routine Session');

select is(public.workout_register_device('87878787-8787-4787-8787-878787878787', 'M08'), '87878787-8787-4787-8787-878787878787'::uuid, 'Device registration succeeds');
select lives_ok(
  $$select public.workout_start_planned(
    '88888888-8888-4888-8888-888888888888',
    '87878787-8787-4787-8787-878787878787',
    (select id from public.routine_week_plans limit 1),
    (select id from public.routine_week_plan_days where day_label_snapshot = 'Legs'),
    1
  )$$,
  'User can choose Legs before Push or Pull'
);
select is((select locked_at is not null from public.routine_week_plans limit 1), true, 'First start locks weekly membership');
select lives_ok($$select public.workout_finish_session('88888888-8888-4888-8888-888888888888','87878787-8787-4787-8787-878787878787',1)$$, 'Chosen Routine Session can finish');
select is((public.routine_get_current_week()->'current_plan'->>'frequency_actual')::integer, 1, 'Finished Routine Session increments Frequency');
select is((public.routine_get_current_week()->'current_plan'->>'coverage_actual')::integer, 1, 'Finished Routine Session covers one distinct Day');

set local role postgres;
insert into public.routine_week_plans(
  user_id, activation_event_id, routine_id, week_start, timezone_snapshot,
  routine_revision_snapshot, routine_name_snapshot, frequency_target_snapshot, day_count_snapshot
)
select '82828282-8282-4282-8282-828282828282', e.id, '85858585-8585-4585-8585-858585858585',
  (now() at time zone 'UTC')::date - (extract(isodow from (now() at time zone 'UTC'))::integer - 1), 'UTC', 1, 'Other user', 1, 1
from public.routine_activation_events e where e.user_id = '81818181-8181-4181-8181-818181818181' limit 1;
set local role authenticated;
select is((select count(*)::integer from public.routine_week_plans where user_id = '82828282-8282-4282-8282-828282828282'), 0, 'RLS hides another user week plan');

select * from finish();
rollback;
