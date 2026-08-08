-- Add the standard parallel-bar dip as a distinct movement from chest-lean and bench dips.

do $$
begin
  if exists (
    select 1
    from public.exercises
    where normalized_name = 'parallel bar dips'
      and owner_user_id is null
      and id <> '00000000-0000-0000-0000-000000000050'::uuid
  ) then
    raise exception 'parallel bar dips normalized_name conflicts with an existing starter UUID';
  end if;
end;
$$;

insert into public.exercises (
  id, owner_user_id, name, normalized_name, equipment_code, primary_muscle_id, notes, archived_at
)
select
  '00000000-0000-0000-0000-000000000050'::uuid,
  null,
  'Parallel Bar Dips',
  'parallel bar dips',
  'bodyweight',
  muscle.id,
  'จับบาร์คู่ให้มั่นคง เกร็งลำตัวและลดตัวด้วยการคุมข้อศอกก่อนดันกลับโดยไม่แกว่ง',
  null
from public.muscles muscle
where muscle.code = 'triceps'
on conflict (id) do update set
  owner_user_id = null,
  name = excluded.name,
  normalized_name = excluded.normalized_name,
  equipment_code = excluded.equipment_code,
  primary_muscle_id = excluded.primary_muscle_id,
  notes = excluded.notes,
  archived_at = null,
  version = public.exercises.version + case when
    public.exercises.owner_user_id is distinct from excluded.owner_user_id or
    public.exercises.name is distinct from excluded.name or
    public.exercises.normalized_name is distinct from excluded.normalized_name or
    public.exercises.equipment_code is distinct from excluded.equipment_code or
    public.exercises.primary_muscle_id is distinct from excluded.primary_muscle_id or
    public.exercises.notes is distinct from excluded.notes or
    public.exercises.archived_at is not null
    then 1 else 0 end,
  updated_at = case when
    public.exercises.owner_user_id is distinct from excluded.owner_user_id or
    public.exercises.name is distinct from excluded.name or
    public.exercises.normalized_name is distinct from excluded.normalized_name or
    public.exercises.equipment_code is distinct from excluded.equipment_code or
    public.exercises.primary_muscle_id is distinct from excluded.primary_muscle_id or
    public.exercises.notes is distinct from excluded.notes or
    public.exercises.archived_at is not null
    then now() else public.exercises.updated_at end;

delete from public.exercise_secondary_muscles
where exercise_id = '00000000-0000-0000-0000-000000000050'::uuid;

insert into public.exercise_secondary_muscles (exercise_id, muscle_id, sequence_no)
select '00000000-0000-0000-0000-000000000050'::uuid, muscle.id, secondary.sequence_no
from (values ('chest', 1), ('shoulders', 2)) as secondary(muscle_code, sequence_no)
join public.muscles muscle on muscle.code = secondary.muscle_code;
