create table public.mutation_receipts (
  operation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  aggregate_type text not null check (aggregate_type = 'WORKOUT_SESSION'),
  aggregate_id uuid not null,
  request_hash text not null,
  result_version integer not null check (result_version >= 1),
  processed_at timestamptz not null default now()
);

create index mutation_receipts_user_processed_idx
  on public.mutation_receipts(user_id, processed_at desc);

alter table public.mutation_receipts enable row level security;
revoke all on table public.mutation_receipts from anon, authenticated;

create or replace function public.workout_apply_command_idempotent(
  p_operation_id uuid,
  p_session_id uuid,
  p_device_id uuid,
  p_expected_version integer,
  p_command jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.mutation_receipts%rowtype;
  v_hash text;
  v_result_version integer;
begin
  if p_operation_id is null then
    raise exception using errcode = '22023', message = 'invalid_operation_id';
  end if;
  if p_command->>'action' <> 'complete_set' then
    raise exception using errcode = '22023', message = 'offline_command_not_supported';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_operation_id::text));
  v_hash := md5(concat_ws('|', p_session_id::text, p_device_id::text, p_expected_version::text, p_command::text));

  select * into v_receipt
  from public.mutation_receipts
  where operation_id = p_operation_id;

  if found then
    if v_receipt.user_id <> auth.uid()
      or v_receipt.aggregate_id <> p_session_id
      or v_receipt.request_hash <> v_hash then
      raise exception using errcode = 'P0001', message = 'operation_id_conflict';
    end if;
    return v_receipt.result_version;
  end if;

  v_result_version := public.workout_apply_command(
    p_session_id,
    p_device_id,
    p_expected_version,
    p_command
  );

  insert into public.mutation_receipts(operation_id, user_id, aggregate_type, aggregate_id, request_hash, result_version)
  values (p_operation_id, auth.uid(), 'WORKOUT_SESSION', p_session_id, v_hash, v_result_version);

  return v_result_version;
end;
$$;

revoke all on function public.workout_apply_command_idempotent(uuid, uuid, uuid, integer, jsonb) from public;
grant execute on function public.workout_apply_command_idempotent(uuid, uuid, uuid, integer, jsonb) to authenticated;
