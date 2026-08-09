begin;

select plan(9);

select has_table('public', 'workout_templates', 'Template aggregate table exists');
select has_table('public', 'template_exercises', 'Template exercise table exists');
select has_table('public', 'template_set_prescriptions', 'Set prescription table exists');
select has_table('public', 'routines', 'Routine aggregate table exists');
select has_table('public', 'routine_days', 'Routine day table exists');
select has_index('public', 'routines', 'routines_one_active_per_user', 'Single active Routine index exists');
select col_not_null('public', 'template_set_prescriptions', 'target_reps_min', 'Set prescriptions require a minimum rep target');
select col_not_null('public', 'routines', 'weekly_frequency_target', 'Routines require weekly frequency');
select has_function('public', 'planning_deactivate_routine', array['uuid', 'integer'], 'Routine deactivate RPC exists');

select * from finish();
rollback;
