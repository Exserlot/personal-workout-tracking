begin;

select plan(14);

select is(
  (select count(*)::int from public.exercises where owner_user_id is null),
  50,
  'starter catalog contains 50 unique exercises'
);

select is(
  (select count(*)::int from (
    select normalized_name from public.exercises where owner_user_id is null group by normalized_name having count(*) > 1
  ) duplicates),
  0,
  'starter normalized names are unique'
);

select is(
  (select count(*)::int from public.exercises where owner_user_id is null and (notes is null or btrim(notes) = '')),
  0,
  'every starter exercise has notes'
);

select is(
  (select count(*)::int from public.exercises where owner_user_id is null and equipment_code not in ('barbell','dumbbell','cable','machine','bodyweight','kettlebell')),
  0,
  'starter equipment codes are supported'
);

select is(
  (select count(*)::int from public.exercises where owner_user_id is null and primary_muscle_id not in (select id from public.muscles where code in ('chest','back','shoulders','biceps','triceps','quadriceps','hamstrings','glutes','calves','core'))),
  0,
  'starter primary muscles use supported codes'
);

select is(
  (select count(*)::int from public.exercises where owner_user_id is null and id in (
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006'
  )),
  6,
  'original six starter UUIDs remain present'
);

select is((select id::text from public.exercises where normalized_name = 'barbell bench press' and owner_user_id is null), '00000000-0000-0000-0000-000000000001', 'bench press keeps its UUID');
select is((select id::text from public.exercises where normalized_name = 'barbell back squat' and owner_user_id is null), '00000000-0000-0000-0000-000000000002', 'back squat keeps its UUID');
select is((select id::text from public.exercises where normalized_name = 'barbell romanian deadlift' and owner_user_id is null), '00000000-0000-0000-0000-000000000003', 'romanian deadlift keeps its UUID');

select is((select id::text from public.exercises where normalized_name = 'parallel bar dips' and owner_user_id is null), '00000000-0000-0000-0000-000000000050', 'parallel bar dips has a stable UUID');

select ok(
  exists (
    select 1
    from public.exercises e
    join public.muscles primary_muscle on primary_muscle.id = e.primary_muscle_id
    join public.exercise_secondary_muscles secondary on secondary.exercise_id = e.id
    join public.muscles secondary_muscle on secondary_muscle.id = secondary.muscle_id
    where e.normalized_name = 'parallel bar dips'
      and e.equipment_code = 'bodyweight'
      and primary_muscle.code = 'triceps'
      and secondary_muscle.code = 'chest'
      and secondary.sequence_no = 1
  ),
  'parallel bar dips uses the expected equipment and muscle mapping'
);

select is(
  (select count(*)::int from public.exercises e join public.exercise_secondary_muscles s on s.exercise_id = e.id where e.owner_user_id is null and e.primary_muscle_id = s.muscle_id),
  0,
  'primary muscle never appears as secondary'
);

select is(
  (select count(*)::int from (
    select s.exercise_id, s.sequence_no, row_number() over (partition by s.exercise_id order by s.sequence_no) as expected_sequence
    from public.exercise_secondary_muscles s join public.exercises e on e.id = s.exercise_id
    where e.owner_user_id is null
  ) sequences where sequence_no <> expected_sequence),
  0,
  'secondary muscle sequences are contiguous'
);

select is(
  (select count(*)::int from public.exercises where owner_user_id is null and archived_at is not null),
  0,
  'starter exercises are active'
);

select * from finish();
rollback;
