-- M-05B: live Progress metrics and personal records derived from completed snapshots.

create or replace function public.progress_eligible_sets(p_user_id uuid)
returns table(
  session_id uuid,
  session_label text,
  completed_at timestamptz,
  exercise_id uuid,
  exercise_name text,
  set_id uuid,
  weight_kg numeric,
  reps integer,
  volume_kg numeric,
  estimated_1rm_kg numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ws.id,
    coalesce(ws.template_name_snapshot, 'Ad-hoc Workout'),
    ws.completed_at,
    wse.source_exercise_id,
    wse.exercise_name_snapshot,
    wss.id,
    wss.actual_weight_kg,
    wss.actual_reps,
    round(wss.actual_weight_kg * wss.actual_reps, 4),
    case
      when wss.actual_weight_kg > 0 and wss.actual_reps between 1 and 10
        then round(wss.actual_weight_kg * (1 + wss.actual_reps::numeric / 30), 4)
      else null
    end
  from public.workout_sessions ws
  join public.workout_session_exercises wse on wse.session_id = ws.id
  join public.workout_session_sets wss on wss.session_exercise_id = wse.id
  where ws.user_id = p_user_id
    and ws.status = 'COMPLETED'
    and ws.deleted_at is null
    and wse.source_exercise_id is not null
    and wss.status = 'COMPLETED'
    and wss.set_kind_code = 'WORKING'
    and wss.is_to_failure = false
    and wss.actual_weight_kg is not null
    and wss.actual_reps is not null;
$$;

revoke all on function public.progress_eligible_sets(uuid) from public, anon, authenticated;

create or replace function public.progress_record_events(p_user_id uuid)
returns table(
  kind text,
  exercise_id uuid,
  exercise_name text,
  session_id uuid,
  set_id uuid,
  achieved_at timestamptz,
  weight_kg numeric,
  reps integer,
  estimated_1rm_kg numeric,
  previous_value numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select * from public.progress_eligible_sets(p_user_id)
  ), candidates as (
    (select distinct on (e.exercise_id, e.session_id)
      'BEST_WEIGHT'::text as kind, e.exercise_id, e.exercise_name, e.session_id, e.set_id,
      e.completed_at as achieved_at, e.weight_kg, e.reps, e.estimated_1rm_kg,
      e.weight_kg as candidate_value, null::numeric as weight_bucket
    from eligible e
    where e.weight_kg > 0
    order by e.exercise_id, e.session_id, e.weight_kg desc, e.reps desc, e.set_id)
    union all
    (select distinct on (e.exercise_id, e.session_id)
      'ESTIMATED_1RM'::text, e.exercise_id, e.exercise_name, e.session_id, e.set_id,
      e.completed_at, e.weight_kg, e.reps, e.estimated_1rm_kg,
      e.estimated_1rm_kg, null::numeric
    from eligible e
    where e.estimated_1rm_kg is not null
    order by e.exercise_id, e.session_id, e.estimated_1rm_kg desc, e.weight_kg desc, e.set_id)
    union all
    (select distinct on (e.exercise_id, e.session_id, round(e.weight_kg, 4))
      'BEST_REPS_AT_WEIGHT'::text, e.exercise_id, e.exercise_name, e.session_id, e.set_id,
      e.completed_at, e.weight_kg, e.reps, e.estimated_1rm_kg,
      e.reps::numeric, round(e.weight_kg, 4)
    from eligible e
    order by e.exercise_id, e.session_id, round(e.weight_kg, 4), e.reps desc, e.set_id)
  ), compared as (
    select c.*,
      (
        select max(p.candidate_value)
        from candidates p
        where p.exercise_id = c.exercise_id
          and p.kind = c.kind
          and p.weight_bucket is not distinct from c.weight_bucket
          and (p.achieved_at, p.session_id) < (c.achieved_at, c.session_id)
      ) as prior_best
    from candidates c
  )
  select c2.kind, c2.exercise_id, c2.exercise_name, c2.session_id, c2.set_id, c2.achieved_at,
    c2.weight_kg, c2.reps, c2.estimated_1rm_kg, c2.prior_best
  from compared c2
  where c2.prior_best is null or c2.candidate_value > c2.prior_best;
$$;

revoke all on function public.progress_record_events(uuid) from public, anon, authenticated;

create or replace function public.progress_get_overview()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select * from public.progress_eligible_sets(auth.uid())
  ), records as (
    select * from public.progress_record_events(auth.uid())
  ), featured as (
    select exercise_id, exercise_name, max(completed_at) as last_trained_at
    from eligible
    group by exercise_id, exercise_name
    order by last_trained_at desc, exercise_id
    limit 1
  ), featured_trend as (
    select e.session_id, max(e.completed_at) as completed_at,
      round(sum(e.volume_kg), 4) as volume_kg,
      max(e.weight_kg) as best_weight_kg,
      max(e.reps) as best_reps,
      max(e.estimated_1rm_kg) as best_estimated_1rm_kg
    from eligible e
    join featured f on f.exercise_id = e.exercise_id
    where e.completed_at >= now() - interval '90 days'
    group by e.session_id
  )
  select jsonb_build_object(
    'source_revision', coalesce((select revision from public.progress_source_state where user_id = auth.uid()), 0),
    'stats', jsonb_build_object(
      'tracked_exercise_count', (select count(distinct exercise_id) from eligible),
      'recent_session_count', (select count(distinct session_id) from eligible where completed_at >= now() - interval '30 days'),
      'recent_volume_kg', coalesce((select round(sum(volume_kg), 4) from eligible where completed_at >= now() - interval '30 days'), 0),
      'recent_pr_count', (select count(*) from records where achieved_at >= now() - interval '30 days')
    ),
    'recent_records', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', kind, 'exercise_id', exercise_id, 'exercise_name', exercise_name,
        'session_id', session_id, 'set_id', set_id, 'achieved_at', achieved_at,
        'weight_kg', weight_kg, 'reps', reps, 'estimated_1rm_kg', estimated_1rm_kg,
        'previous_value', previous_value
      ) order by achieved_at desc, session_id desc, kind)
      from (select * from records order by achieved_at desc, session_id desc, kind limit 10) recent
    ), '[]'::jsonb),
    'featured_exercise', case when exists(select 1 from featured) then (
      select jsonb_build_object(
        'exercise_id', f.exercise_id, 'exercise_name', f.exercise_name,
        'last_trained_at', f.last_trained_at,
        'trend', coalesce((select jsonb_agg(jsonb_build_object(
          'session_id', t.session_id, 'completed_at', t.completed_at,
          'volume_kg', t.volume_kg, 'best_weight_kg', t.best_weight_kg,
          'best_reps', t.best_reps, 'best_estimated_1rm_kg', t.best_estimated_1rm_kg
        ) order by t.completed_at, t.session_id) from featured_trend t), '[]'::jsonb)
      ) from featured f
    ) else null end
  );
$$;

create or replace function public.progress_list_exercises(
  p_search text default null,
  p_cursor_last_trained_at timestamptz default null,
  p_cursor_exercise_id uuid default null,
  p_limit integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select * from public.progress_eligible_sets(auth.uid())
  ), sessions as (
    select exercise_id, exercise_name, session_id, max(completed_at) as completed_at,
      sum(volume_kg) as volume_kg, max(weight_kg) as best_weight_kg,
      max(estimated_1rm_kg) as best_e1rm_kg, count(*) as set_count
    from eligible
    group by exercise_id, exercise_name, session_id
  ), aggregate_rows as (
    select exercise_id,
      (array_agg(exercise_name order by completed_at desc, session_id desc))[1] as exercise_name,
      max(completed_at) as last_trained_at,
      count(*)::integer as session_count,
      sum(set_count)::integer as working_set_count,
      max(best_weight_kg) as all_time_best_weight_kg,
      max(best_e1rm_kg) as all_time_best_estimated_1rm_kg,
      (array_agg(volume_kg order by completed_at desc, session_id desc))[1] as latest_session_volume_kg
    from sessions
    group by exercise_id
  ), page as (
    select * from aggregate_rows
    where (p_search is null or exercise_name ilike '%' || p_search || '%')
      and (p_cursor_last_trained_at is null or (last_trained_at, exercise_id) < (p_cursor_last_trained_at, p_cursor_exercise_id))
    order by last_trained_at desc, exercise_id desc
    limit greatest(1, least(coalesce(p_limit, 20) + 1, 101))
  ), visible as (
    select * from page order by last_trained_at desc, exercise_id desc limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  select jsonb_build_object(
    'source_revision', coalesce((select revision from public.progress_source_state where user_id = auth.uid()), 0),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'exercise_id', exercise_id, 'exercise_name', exercise_name,
      'last_trained_at', last_trained_at, 'session_count', session_count,
      'working_set_count', working_set_count, 'all_time_best_weight_kg', all_time_best_weight_kg,
      'all_time_best_estimated_1rm_kg', all_time_best_estimated_1rm_kg,
      'latest_session_volume_kg', latest_session_volume_kg
    ) order by last_trained_at desc, exercise_id desc) from visible), '[]'::jsonb),
    'next_cursor', case when (select count(*) from page) > greatest(1, least(coalesce(p_limit, 20), 100)) then (
      select jsonb_build_object('last_trained_at', last_trained_at, 'exercise_id', exercise_id)
      from visible order by last_trained_at, exercise_id limit 1
    ) else null end
  );
$$;

create or replace function public.progress_get_exercise_detail(
  p_exercise_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_point_limit integer default 250
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with all_sets as (
    select * from public.progress_eligible_sets(auth.uid()) where exercise_id = p_exercise_id
  ), ranged as (
    select * from all_sets
    where (p_from is null or completed_at >= p_from)
      and (p_to is null or completed_at < p_to)
  ), per_session as (
    select session_id, max(completed_at) as completed_at,
      round(sum(volume_kg), 4) as volume_kg, max(weight_kg) as best_weight_kg,
      max(reps) as best_reps, max(estimated_1rm_kg) as best_estimated_1rm_kg
    from ranged group by session_id
  ), limited_desc as (
    select * from per_session order by completed_at desc, session_id desc
    limit greatest(1, least(coalesce(p_point_limit, 250), 250))
  ), record_events as (
    select * from public.progress_record_events(auth.uid()) where exercise_id = p_exercise_id
  ), latest_records as (
    select distinct on (kind) * from record_events order by kind, achieved_at desc, session_id desc
  ), reps_by_weight as (
    select distinct on (round(weight_kg, 4)) round(weight_kg, 4) as weight_kg, reps,
      session_id, set_id, completed_at as achieved_at
    from all_sets
    order by round(weight_kg, 4), reps desc, completed_at, session_id, set_id
  ), best_reps_row as (
    select reps, weight_kg from ranged order by reps desc, weight_kg desc, completed_at desc, set_id desc limit 1
  )
  select case when not exists(select 1 from all_sets) then null else jsonb_build_object(
    'source_revision', coalesce((select revision from public.progress_source_state where user_id = auth.uid()), 0),
    'exercise_id', p_exercise_id,
    'exercise_name', (select exercise_name from all_sets order by completed_at desc, session_id desc limit 1),
    'metrics', jsonb_build_object(
      'session_count', (select count(*) from per_session),
      'working_set_count', (select count(*) from ranged),
      'best_weight_kg', coalesce((select max(weight_kg) from ranged), 0),
      'best_reps', coalesce((select reps from best_reps_row), 0),
      'best_reps_weight_kg', coalesce((select weight_kg from best_reps_row), 0),
      'best_estimated_1rm_kg', (select max(estimated_1rm_kg) from ranged),
      'total_volume_kg', coalesce((select round(sum(volume_kg), 4) from ranged), 0)
    ),
    'trend', coalesce((select jsonb_agg(jsonb_build_object(
      'session_id', session_id, 'completed_at', completed_at, 'volume_kg', volume_kg,
      'best_weight_kg', best_weight_kg, 'best_reps', best_reps,
      'best_estimated_1rm_kg', best_estimated_1rm_kg
    ) order by completed_at, session_id) from limited_desc), '[]'::jsonb),
    'all_time_records', coalesce((select jsonb_agg(jsonb_build_object(
      'kind', kind, 'exercise_id', exercise_id, 'exercise_name', exercise_name,
      'session_id', session_id, 'set_id', set_id, 'achieved_at', achieved_at,
      'weight_kg', weight_kg, 'reps', reps, 'estimated_1rm_kg', estimated_1rm_kg,
      'previous_value', previous_value
    ) order by kind) from latest_records), '[]'::jsonb),
    'reps_at_weight', coalesce((select jsonb_agg(jsonb_build_object(
      'weight_kg', weight_kg, 'reps', reps, 'session_id', session_id,
      'set_id', set_id, 'achieved_at', achieved_at
    ) order by weight_kg desc) from reps_by_weight), '[]'::jsonb),
    'has_positive_weight', exists(select 1 from all_sets where weight_kg > 0),
    'truncated', (select count(*) from per_session) > greatest(1, least(coalesce(p_point_limit, 250), 250))
  ) end;
$$;

create or replace function public.progress_list_session_records(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'source_revision', coalesce((select revision from public.progress_source_state where user_id = auth.uid()), 0),
    'records', coalesce((select jsonb_agg(jsonb_build_object(
      'kind', r.kind, 'exercise_id', r.exercise_id, 'exercise_name', r.exercise_name,
      'session_id', r.session_id, 'set_id', r.set_id, 'achieved_at', r.achieved_at,
      'weight_kg', r.weight_kg, 'reps', r.reps, 'estimated_1rm_kg', r.estimated_1rm_kg,
      'previous_value', r.previous_value
    ) order by r.exercise_name, r.kind)
    from public.progress_record_events(auth.uid()) r
    join public.workout_sessions ws on ws.id = r.session_id
    where r.session_id = p_session_id and ws.user_id = auth.uid() and ws.deleted_at is null), '[]'::jsonb)
  );
$$;

revoke all on function public.progress_get_overview() from public, anon;
revoke all on function public.progress_list_exercises(text, timestamptz, uuid, integer) from public, anon;
revoke all on function public.progress_get_exercise_detail(uuid, timestamptz, timestamptz, integer) from public, anon;
revoke all on function public.progress_list_session_records(uuid) from public, anon;
grant execute on function public.progress_get_overview() to authenticated;
grant execute on function public.progress_list_exercises(text, timestamptz, uuid, integer) to authenticated;
grant execute on function public.progress_get_exercise_detail(uuid, timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.progress_list_session_records(uuid) to authenticated;
