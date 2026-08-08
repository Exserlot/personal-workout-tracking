create extension if not exists pgcrypto;

create table if not exists public.muscles (
  id uuid primary key default gen_random_uuid(),
  code varchar(40) not null unique,
  name varchar(120) not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete restrict,
  name varchar(160) not null,
  normalized_name varchar(160) not null,
  equipment_code varchar(40) not null,
  primary_muscle_id uuid not null references public.muscles(id) on delete restrict,
  notes text,
  archived_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists exercises_starter_name_key
  on public.exercises (normalized_name)
  where owner_user_id is null;

create unique index if not exists exercises_custom_name_key
  on public.exercises (owner_user_id, normalized_name)
  where owner_user_id is not null;

create table if not exists public.exercise_secondary_muscles (
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  muscle_id uuid not null references public.muscles(id) on delete restrict,
  sequence_no integer not null check (sequence_no > 0),
  primary key (exercise_id, muscle_id),
  unique (exercise_id, sequence_no)
);

create or replace function public.reject_primary_secondary_overlap()
returns trigger
language plpgsql
as $$
declare
  primary_id uuid;
begin
  select primary_muscle_id into primary_id
  from public.exercises
  where id = new.exercise_id;

  if primary_id = new.muscle_id then
    raise exception 'secondary muscle cannot equal primary muscle';
  end if;
  return new;
end;
$$;

create or replace function public.reject_primary_change_overlap()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.exercise_secondary_muscles
    where exercise_id = new.id and muscle_id = new.primary_muscle_id
  ) then
    raise exception 'primary muscle cannot equal a secondary muscle';
  end if;
  return new;
end;
$$;

drop trigger if exists exercise_primary_muscle_overlap on public.exercises;
create trigger exercise_primary_muscle_overlap
before update of primary_muscle_id on public.exercises
for each row execute function public.reject_primary_change_overlap();

drop trigger if exists exercise_secondary_muscle_overlap on public.exercise_secondary_muscles;
create constraint trigger exercise_secondary_muscle_overlap
after insert or update on public.exercise_secondary_muscles
deferrable initially immediate
for each row execute function public.reject_primary_secondary_overlap();

create or replace function public.touch_exercise_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists exercises_touch_updated_at on public.exercises;
create trigger exercises_touch_updated_at
before update on public.exercises
for each row execute function public.touch_exercise_updated_at();

alter table public.muscles enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_secondary_muscles enable row level security;

drop policy if exists "muscles are readable" on public.muscles;
create policy "muscles are readable" on public.muscles
for select using (archived_at is null);

drop policy if exists "starter or owned exercises are readable" on public.exercises;
create policy "starter or owned exercises are readable" on public.exercises
for select using (owner_user_id is null or owner_user_id = auth.uid());

drop policy if exists "owners insert exercises" on public.exercises;
create policy "owners insert exercises" on public.exercises
for insert with check (owner_user_id = auth.uid());

drop policy if exists "owners update exercises" on public.exercises;
create policy "owners update exercises" on public.exercises
for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

drop policy if exists "read exercise secondary muscles" on public.exercise_secondary_muscles;
create policy "read exercise secondary muscles" on public.exercise_secondary_muscles
for select using (
  exists (
    select 1 from public.exercises e
    where e.id = exercise_id and (e.owner_user_id is null or e.owner_user_id = auth.uid())
  )
);

drop policy if exists "owners manage exercise secondary muscles" on public.exercise_secondary_muscles;
create policy "owners manage exercise secondary muscles" on public.exercise_secondary_muscles
for all using (
  exists (select 1 from public.exercises e where e.id = exercise_id and e.owner_user_id = auth.uid())
) with check (
  exists (select 1 from public.exercises e where e.id = exercise_id and e.owner_user_id = auth.uid())
);

create or replace function public.create_custom_exercise(
  p_name varchar,
  p_normalized_name varchar,
  p_equipment_code varchar,
  p_primary_muscle_code varchar,
  p_secondary_muscle_codes varchar[],
  p_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_exercise_id uuid;
  v_primary_id uuid;
  v_secondary_code varchar;
  v_sequence_no integer := 1;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select m.id into v_primary_id from public.muscles m where m.code = p_primary_muscle_code and m.archived_at is null;
  if v_primary_id is null then raise exception 'invalid primary muscle'; end if;

  insert into public.exercises (owner_user_id, name, normalized_name, equipment_code, primary_muscle_id, notes)
  values (auth.uid(), p_name, p_normalized_name, p_equipment_code, v_primary_id, p_notes)
  returning id into v_exercise_id;

  foreach v_secondary_code in array coalesce(p_secondary_muscle_codes, array[]::varchar[]) loop
    insert into public.exercise_secondary_muscles (exercise_id, muscle_id, sequence_no)
    select v_exercise_id, m.id, v_sequence_no from public.muscles m where m.code = v_secondary_code and m.archived_at is null;
    if not found then raise exception 'invalid secondary muscle'; end if;
    v_sequence_no := v_sequence_no + 1;
  end loop;
  return v_exercise_id;
end;
$$;

create or replace function public.update_custom_exercise(
  p_exercise_id uuid,
  p_expected_version integer,
  p_name varchar,
  p_normalized_name varchar,
  p_equipment_code varchar,
  p_primary_muscle_code varchar,
  p_secondary_muscle_codes varchar[],
  p_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_primary_id uuid;
  v_secondary_code varchar;
  v_sequence_no integer := 1;
begin
  select m.id into v_primary_id from public.muscles m where m.code = p_primary_muscle_code and m.archived_at is null;
  if v_primary_id is null then raise exception 'invalid primary muscle'; end if;
  update public.exercises
  set name = p_name, normalized_name = p_normalized_name, equipment_code = p_equipment_code,
      primary_muscle_id = v_primary_id, notes = p_notes, version = version + 1
  where id = p_exercise_id and owner_user_id = auth.uid() and archived_at is null and version = p_expected_version;
  if not found then raise exception 'exercise version conflict or not found'; end if;

  delete from public.exercise_secondary_muscles where exercise_id = p_exercise_id;
  foreach v_secondary_code in array coalesce(p_secondary_muscle_codes, array[]::varchar[]) loop
    insert into public.exercise_secondary_muscles (exercise_id, muscle_id, sequence_no)
    select p_exercise_id, m.id, v_sequence_no from public.muscles m where m.code = v_secondary_code and m.archived_at is null;
    if not found then raise exception 'invalid secondary muscle'; end if;
    v_sequence_no := v_sequence_no + 1;
  end loop;
  return p_exercise_id;
end;
$$;

create or replace function public.archive_custom_exercise(
  p_exercise_id uuid,
  p_expected_version integer
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.exercises
  set archived_at = now(), version = version + 1
  where id = p_exercise_id and owner_user_id = auth.uid() and archived_at is null and version = p_expected_version;
  if not found then raise exception 'exercise version conflict or not found'; end if;
  return p_exercise_id;
end;
$$;
