begin;

select plan(41);

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
  v_inactive_template uuid := '83838383-8383-4383-8383-838383838384';
  v_template_exercise uuid := '84848484-8484-4484-8484-848484848484';
  v_routine uuid := '85858585-8585-4585-8585-858585858585';
  v_inactive_routine uuid := '85858585-8585-4585-8585-858585858586';
begin
  insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at) values
    (v_user, 'authenticated', 'authenticated', 'm08@example.test', 'x', now()),
    (v_other, 'authenticated', 'authenticated', 'm08-other@example.test', 'x', now());
  insert into public.workout_templates(id, user_id, name) values
    (v_template, v_user, 'PPL'),
    (v_inactive_template, v_user, 'Draft template');
  insert into public.template_exercises(id, template_id, exercise_id, sequence_no)
    values (v_template_exercise, v_template, '00000000-0000-0000-0000-000000000001', 1);
  insert into public.template_set_prescriptions(template_exercise_id, sequence_no, target_reps_min, target_reps_max)
    values (v_template_exercise, 1, 8, 10);
  insert into public.routines(id, user_id, name, weekly_frequency_target, is_active)
    values (v_routine, v_user, 'Flexible PPL', 3, true);
  insert into public.routines(id, user_id, name, weekly_frequency_target, is_active)
    values (v_inactive_routine, v_user, 'Inactive draft', 1, false);
  insert into public.routine_days(id, routine_id, template_id, sequence_no, label) values
    ('86111111-1111-4111-8111-111111111111', v_routine, v_template, 1, 'Push'),
    ('86222222-2222-4222-8222-222222222222', v_routine, v_template, 2, 'Pull'),
    ('86333333-3333-4333-8333-333333333333', v_routine, v_template, 3, 'Legs'),
    ('86444444-4444-4444-8444-444444444444', v_inactive_routine, v_inactive_template, 1, 'Draft');
  insert into public.user_preferences(user_id, timezone) values (v_other, 'UTC');
end;
$$;

select set_config('request.jwt.claim.sub', '81818181-8181-4181-8181-818181818181', true);
set local role authenticated;

select is(public.preferences_get_or_create_timezone('Asia/Bangkok'), 'Asia/Bangkok', 'Browser timezone initializes preferences');
select is((select count(*)::integer from public.routine_activation_events), 1, 'First app load backfills the legacy Active Routine');
select throws_ok($$select public.preferences_update_timezone('Mars/Olympus')$$, 'invalid_timezone', 'Invalid IANA timezone is rejected');
select throws_ok(
  $$select public.planning_archive_template('83838383-8383-4383-8383-838383838383', 1)$$,
  'template_referenced_by_active_routine',
  'Template referenced by the Active Routine cannot be archived'
);
select lives_ok(
  $$select public.planning_archive_template('83838383-8383-4383-8383-838383838384', 1)$$,
  'Template referenced only by an inactive draft Routine can be archived'
);
select isnt((select archived_at from public.workout_templates where id = '83838383-8383-4383-8383-838383838384'), null, 'Inactive draft Template is archived');

select is(public.workout_register_device('87878787-8787-4787-8787-878787878787', 'M08'), '87878787-8787-4787-8787-878787878787'::uuid, 'Device registration succeeds');
select lives_ok(
  $$select public.workout_start_planned(
    '88999999-9999-4999-8999-999999999999',
    '87878787-8787-4787-8787-878787878787',
    '85858585-8585-4585-8585-858585858585',
    1,
    1
  )$$,
  'Legacy client can still start its fixed-sequence Routine Day'
);
select lives_ok(
  $$select public.workout_finish_session(
    '88999999-9999-4999-8999-999999999999',
    '87878787-8787-4787-8787-878787878787',
    1
  )$$,
  'Legacy planned Session can still finish'
);
select is((select next_workout_index from public.routines where id = '85858585-8585-4585-8585-858585858585'), 1, 'Legacy finish still advances the compatibility pointer');

select lives_ok(
  $$select public.planning_activate_routine(
    '85858585-8585-4585-8585-858585858585', 2,
    (now() at time zone 'Asia/Bangkok')::date - (extract(isodow from (now() at time zone 'Asia/Bangkok'))::integer - 1)
  )$$,
  'Routine can activate for current week'
);
select is((select count(*)::integer from public.routine_week_plans), 1, 'Current week materializes once');
select is((select count(*)::integer from public.routine_week_plan_days), 3, 'All coverage identities are snapshotted');
select is((select locked_at is null from public.routine_week_plans limit 1), true, 'Plan is unlocked before first Routine Session');

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
select is((public.routine_get_current_week()->'current_plan'->'days'->2->>'active_count')::integer, 1, 'Active Routine Day is exposed while the Session is in progress');
select lives_ok($$select public.workout_finish_session('88888888-8888-4888-8888-888888888888','87878787-8787-4787-8787-878787878787',1)$$, 'Chosen Routine Session can finish');
select is((public.routine_get_current_week()->'current_plan'->>'frequency_actual')::integer, 1, 'Finished Routine Session increments Frequency');
select is((public.routine_get_current_week()->'current_plan'->>'coverage_actual')::integer, 1, 'Finished Routine Session covers one distinct Day');
select lives_ok(
  $$select public.workout_start_planned(
    '88111111-1111-4111-8111-111111111111',
    '87878787-8787-4787-8787-878787878787',
    (select id from public.routine_week_plans order by week_start desc limit 1),
    (select id from public.routine_week_plan_days where day_label_snapshot = 'Legs' order by created_at desc limit 1),
    1
  )$$,
  'A covered Routine Day remains repeatable'
);
select lives_ok($$select public.workout_finish_session('88111111-1111-4111-8111-111111111111','87878787-8787-4787-8787-878787878787',1)$$, 'Repeated Routine Day can finish');
select is((public.routine_get_current_week()->'current_plan'->>'frequency_actual')::integer, 2, 'Repeat increases Frequency');
select is((public.routine_get_current_week()->'current_plan'->>'coverage_actual')::integer, 1, 'Repeat does not increase Coverage twice');

set local role postgres;
update public.routine_activation_events
set effective_week_start = effective_week_start - 14
where user_id = '81818181-8181-4181-8181-818181818181';
set local role authenticated;
select lives_ok($$select public.routine_reconcile_weeks()$$, 'Missed weeks materialize on the next reconciliation');
select is((select count(*)::integer from public.routine_week_plans where user_id = '81818181-8181-4181-8181-818181818181'), 3, 'Zero-session Routine Weeks are durable history');
select is((select count(*)::integer from public.weekly_routine_notifications where user_id = '81818181-8181-4181-8181-818181818181'), 2, 'Each finalized missed week creates its own notification');

set local role postgres;
delete from public.weekly_routine_notifications
where week_plan_id = (select id from public.routine_week_plans order by week_start limit 1);
update public.routine_week_plans
set notification_decided_at = null
where id = (select id from public.routine_week_plans order by week_start limit 1);
insert into public.workout_sessions(
  id, user_id, owner_device_id, source_type,
  source_routine_id, source_routine_day_id, source_template_id,
  source_routine_week_plan_id, source_routine_week_plan_day_id,
  source_routine_revision, source_template_revision,
  routine_name_snapshot, day_label_snapshot, template_name_snapshot,
  status, started_at
)
select
  '88222222-2222-4222-8222-222222222222',
  '81818181-8181-4181-8181-818181818181',
  '87878787-8787-4787-8787-878787878787',
  'PLANNED',
  p.routine_id,
  d.source_routine_day_id,
  d.source_template_id,
  p.id,
  d.id,
  p.routine_revision_snapshot,
  1,
  p.routine_name_snapshot,
  d.day_label_snapshot,
  d.template_name_snapshot,
  'ACTIVE',
  p.week_start::timestamptz + interval '1 day'
from public.routine_week_plans p
join public.routine_week_plan_days d on d.week_plan_id = p.id
where p.id = (select id from public.routine_week_plans order by week_start limit 1)
order by d.display_order
limit 1;
set local role authenticated;
select lives_ok($$select public.routine_reconcile_weeks()$$, 'Cross-week Active Session reconciles without finalizing the old week');
select is((select status from public.routine_week_plans order by week_start limit 1), 'PROVISIONAL', 'Old Routine Week remains provisional while its Session is Active');
select is((public.routine_get_week((select id from public.routine_week_plans order by week_start limit 1))->'days'->0->>'active_count')::integer, 1, 'Provisional history identifies the Active Routine Day');
select lives_ok($$select public.workout_discard_session('88222222-2222-4222-8222-222222222222','87878787-8787-4787-8787-878787878787',1)$$, 'Discard resolves a cross-week Active Session');
select is((select status from public.routine_week_plans order by week_start limit 1), 'FINALIZED', 'Old Routine Week finalizes after the crossing Session resolves');
select is((select count(*)::integer from public.weekly_routine_notifications where user_id = '81818181-8181-4181-8181-818181818181'), 2, 'Resolved missed week recreates only its own notification');

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
