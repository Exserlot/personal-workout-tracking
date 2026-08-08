insert into public.muscles (code, name)
values
  ('chest', 'Chest'),
  ('back', 'Back'),
  ('shoulders', 'Shoulders'),
  ('biceps', 'Biceps'),
  ('triceps', 'Triceps'),
  ('quadriceps', 'Quadriceps'),
  ('hamstrings', 'Hamstrings'),
  ('glutes', 'Glutes'),
  ('calves', 'Calves'),
  ('core', 'Core')
on conflict (code) do update set name = excluded.name, archived_at = null;

insert into public.exercises (id, owner_user_id, name, normalized_name, equipment_code, primary_muscle_id, notes)
select seed.id::uuid, null, seed.name, seed.normalized_name, seed.equipment_code, muscle.id, seed.notes
from (values
  ('00000000-0000-0000-0000-000000000001', 'Barbell Bench Press', 'barbell bench press', 'barbell', 'chest', 'Compound horizontal press performed on a flat bench.'),
  ('00000000-0000-0000-0000-000000000002', 'Back Squat', 'back squat', 'barbell', 'quadriceps', 'Barbell squat with the load supported across the upper back.'),
  ('00000000-0000-0000-0000-000000000003', 'Romanian Deadlift', 'romanian deadlift', 'barbell', 'hamstrings', 'Hip-hinge movement emphasizing the posterior chain.'),
  ('00000000-0000-0000-0000-000000000004', 'Lat Pulldown', 'lat pulldown', 'cable', 'back', 'Vertical cable pull performed from a seated position.'),
  ('00000000-0000-0000-0000-000000000005', 'Barbell Overhead Press', 'barbell overhead press', 'barbell', 'shoulders', 'Standing vertical press with a barbell.'),
  ('00000000-0000-0000-0000-000000000006', 'Pull-up', 'pull-up', 'bodyweight', 'back', 'Bodyweight vertical pull from a hanging position.')
) as seed(id, name, normalized_name, equipment_code, primary_code, notes)
join public.muscles muscle on muscle.code = seed.primary_code
on conflict (id) do update set name = excluded.name, notes = excluded.notes, archived_at = null;

insert into public.exercise_secondary_muscles (exercise_id, muscle_id, sequence_no)
select exercise.id, muscle.id, secondary.sequence_no
from (values
  ('00000000-0000-0000-0000-000000000001', 'triceps', 1),
  ('00000000-0000-0000-0000-000000000001', 'shoulders', 2),
  ('00000000-0000-0000-0000-000000000002', 'glutes', 1),
  ('00000000-0000-0000-0000-000000000002', 'hamstrings', 2),
  ('00000000-0000-0000-0000-000000000002', 'core', 3),
  ('00000000-0000-0000-0000-000000000003', 'glutes', 1),
  ('00000000-0000-0000-0000-000000000003', 'back', 2),
  ('00000000-0000-0000-0000-000000000004', 'biceps', 1),
  ('00000000-0000-0000-0000-000000000005', 'triceps', 1),
  ('00000000-0000-0000-0000-000000000005', 'core', 2),
  ('00000000-0000-0000-0000-000000000006', 'biceps', 1),
  ('00000000-0000-0000-0000-000000000006', 'core', 2)
) as secondary(exercise_id, muscle_code, sequence_no)
join public.exercises exercise on exercise.id = secondary.exercise_id::uuid
join public.muscles muscle on muscle.code = secondary.muscle_code
on conflict (exercise_id, muscle_id) do update set sequence_no = excluded.sequence_no;
