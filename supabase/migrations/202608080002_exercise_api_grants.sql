grant usage on schema public to anon, authenticated;

grant select on table
  public.muscles,
  public.exercises,
  public.exercise_secondary_muscles
to anon, authenticated;

grant insert, update on table public.exercises to authenticated;
grant insert, update, delete on table public.exercise_secondary_muscles to authenticated;

revoke execute on function public.create_custom_exercise(
  varchar,
  varchar,
  varchar,
  varchar,
  varchar[],
  text
) from public, anon;

revoke execute on function public.update_custom_exercise(
  uuid,
  integer,
  varchar,
  varchar,
  varchar,
  varchar,
  varchar[],
  text
) from public, anon;

revoke execute on function public.archive_custom_exercise(uuid, integer)
from public, anon;

grant execute on function public.create_custom_exercise(
  varchar,
  varchar,
  varchar,
  varchar,
  varchar[],
  text
) to authenticated;

grant execute on function public.update_custom_exercise(
  uuid,
  integer,
  varchar,
  varchar,
  varchar,
  varchar,
  varchar[],
  text
) to authenticated;

grant execute on function public.archive_custom_exercise(uuid, integer)
to authenticated;
