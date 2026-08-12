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
  v_session public.workout_sessions%rowtype;
  v_hash text;
  v_result_version integer;
  v_action text;
begin
  if p_operation_id is null then
    raise exception using errcode = '22023', message = 'invalid_operation_id';
  end if;

  v_action := p_command->>'action';
  if v_action not in ('complete_set', 'edit_set', 'skip_set', 'add_set', 'delete_set', 'finish_session', 'discard_session') then
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

  if v_action in ('finish_session', 'discard_session') then
    select * into v_session
    from public.workout_sessions
    where id = p_session_id
    for update;

    if not found or v_session.user_id <> auth.uid() then
      raise exception using errcode = 'P0002', message = 'session_not_found';
    end if;
    if v_session.status <> 'ACTIVE' then
      raise exception using errcode = 'P0001', message = 'session_not_active';
    end if;
    if v_session.owner_device_id <> p_device_id then
      raise exception using errcode = 'P0001', message = 'device_locked';
    end if;
    if v_session.version <> p_expected_version then
      raise exception using errcode = '40001', message = 'revision_conflict';
    end if;

    if v_action = 'finish_session' then
      perform public.workout_finish_session(p_session_id, p_device_id, p_expected_version);
    else
      perform public.workout_discard_session(p_session_id, p_device_id, p_expected_version);
    end if;

    select version into v_result_version
    from public.workout_sessions
    where id = p_session_id;
  else
    v_result_version := public.workout_apply_command(
      p_session_id,
      p_device_id,
      p_expected_version,
      p_command
    );
  end if;

  insert into public.mutation_receipts(operation_id, user_id, aggregate_type, aggregate_id, request_hash, result_version)
  values (p_operation_id, auth.uid(), 'WORKOUT_SESSION', p_session_id, v_hash, v_result_version);

  return v_result_version;
end;
$$;

revoke all on function public.workout_apply_command_idempotent(uuid, uuid, uuid, integer, jsonb) from public;
grant execute on function public.workout_apply_command_idempotent(uuid, uuid, uuid, integer, jsonb) to authenticated;
