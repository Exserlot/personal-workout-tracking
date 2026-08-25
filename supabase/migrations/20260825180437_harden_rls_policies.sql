-- Keep trigger-function name resolution deterministic and satisfy the security
-- advisor without changing the functions' invoker privileges.
alter function public.reject_primary_secondary_overlap() set search_path = '';
alter function public.reject_primary_change_overlap() set search_path = '';
alter function public.touch_exercise_updated_at() set search_path = '';

-- Evaluate auth.uid() once per statement instead of once per candidate row.
alter policy "starter or owned exercises are readable" on public.exercises
  using (owner_user_id is null or owner_user_id = (select auth.uid()));

alter policy "owners insert exercises" on public.exercises
  with check (owner_user_id = (select auth.uid()));

alter policy "owners update exercises" on public.exercises
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

alter policy "read exercise secondary muscles" on public.exercise_secondary_muscles
  using (
    exists (
      select 1 from public.exercises e
      where e.id = exercise_id
        and (e.owner_user_id is null or e.owner_user_id = (select auth.uid()))
    )
  );

-- The former FOR ALL policy overlapped the read policy for SELECT. Separate
-- mutation policies preserve the same owner checks without redundant reads.
drop policy "owners manage exercise secondary muscles" on public.exercise_secondary_muscles;

create policy "owners insert exercise secondary muscles" on public.exercise_secondary_muscles
  for insert to authenticated
  with check (
    exists (
      select 1 from public.exercises e
      where e.id = exercise_id and e.owner_user_id = (select auth.uid())
    )
  );

create policy "owners update exercise secondary muscles" on public.exercise_secondary_muscles
  for update to authenticated
  using (
    exists (
      select 1 from public.exercises e
      where e.id = exercise_id and e.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.exercises e
      where e.id = exercise_id and e.owner_user_id = (select auth.uid())
    )
  );

create policy "owners delete exercise secondary muscles" on public.exercise_secondary_muscles
  for delete to authenticated
  using (
    exists (
      select 1 from public.exercises e
      where e.id = exercise_id and e.owner_user_id = (select auth.uid())
    )
  );

alter policy "owners manage workout templates" on public.workout_templates
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "owners manage template exercises" on public.template_exercises
  using (
    exists (
      select 1 from public.workout_templates wt
      where wt.id = template_exercises.template_id
        and wt.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.workout_templates wt
      where wt.id = template_exercises.template_id
        and wt.user_id = (select auth.uid())
    )
  );

alter policy "owners manage set prescriptions" on public.template_set_prescriptions
  using (
    exists (
      select 1
      from public.template_exercises te
      join public.workout_templates wt on wt.id = te.template_id
      where te.id = template_set_prescriptions.template_exercise_id
        and wt.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.template_exercises te
      join public.workout_templates wt on wt.id = te.template_id
      where te.id = template_set_prescriptions.template_exercise_id
        and wt.user_id = (select auth.uid())
    )
  );

alter policy "owners manage routines" on public.routines
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "owners manage routine days" on public.routine_days
  using (
    exists (
      select 1 from public.routines r
      where r.id = routine_days.routine_id
        and r.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.routines r
      where r.id = routine_days.routine_id
        and r.user_id = (select auth.uid())
    )
  );

alter policy "owners read devices" on public.devices
  using (user_id = (select auth.uid()));

alter policy "owners read workout sessions" on public.workout_sessions
  using (user_id = (select auth.uid()));

alter policy "owners read session exercises" on public.workout_session_exercises
  using (
    exists (
      select 1 from public.workout_sessions ws
      where ws.id = session_id and ws.user_id = (select auth.uid())
    )
  );

alter policy "owners read session muscles" on public.workout_session_exercise_muscles
  using (
    exists (
      select 1
      from public.workout_session_exercises wse
      join public.workout_sessions ws on ws.id = wse.session_id
      where wse.id = session_exercise_id and ws.user_id = (select auth.uid())
    )
  );

alter policy "owners read session sets" on public.workout_session_sets
  using (
    exists (
      select 1
      from public.workout_session_exercises wse
      join public.workout_sessions ws on ws.id = wse.session_id
      where wse.id = session_exercise_id and ws.user_id = (select auth.uid())
    )
  );

alter policy "owners read progress source state" on public.progress_source_state
  using (user_id = (select auth.uid()));
