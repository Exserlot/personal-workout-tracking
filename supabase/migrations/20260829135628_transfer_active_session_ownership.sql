-- Transfer the single-writer lease for an Active Session to another registered
-- device owned by the same user. The canonical server snapshot is unchanged.
create or replace function public.workout_transfer_session_ownership(
  p_operation_id uuid,
  p_session_id uuid,
  p_to_device_id uuid,
  p_expected_version integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt public.mutation_receipts%rowtype;
  v_session public.workout_sessions%rowtype;
  v_hash text;
  v_result_version integer;
begin
  if p_operation_id is null
     or p_session_id is null
     or p_to_device_id is null
     or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'invalid_ownership_transfer_request';
  end if;

  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_operation_id::text));
  v_hash := pg_catalog.md5(pg_catalog.concat_ws(
    '|',
    p_session_id::text,
    p_to_device_id::text,
    p_expected_version::text,
    'transfer_ownership'
  ));

  select *
    into v_receipt
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

  select *
    into v_session
    from public.workout_sessions
   where id = p_session_id
   for update;
  if not found or v_session.user_id <> auth.uid() then
    raise exception using errcode = 'P0002', message = 'session_not_found';
  end if;

  if not exists (
    select 1
      from public.devices
     where id = p_to_device_id
       and user_id = auth.uid()
       and revoked_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'target_device_unavailable';
  end if;

  if v_session.status <> 'ACTIVE' then
    raise exception using errcode = 'P0001', message = 'session_not_active';
  end if;

  if v_session.owner_device_id = p_to_device_id then
    v_result_version := v_session.version;
  else
    if v_session.version <> p_expected_version then
      raise exception using errcode = '40001', message = 'revision_conflict';
    end if;

    update public.workout_sessions
       set owner_device_id = p_to_device_id,
           version = version + 1,
           edited_at = pg_catalog.now(),
           updated_at = pg_catalog.now()
     where id = p_session_id
     returning version into v_result_version;
  end if;

  insert into public.mutation_receipts(
    operation_id,
    user_id,
    aggregate_type,
    aggregate_id,
    request_hash,
    result_version
  )
  values (
    p_operation_id,
    auth.uid(),
    'WORKOUT_SESSION',
    p_session_id,
    v_hash,
    v_result_version
  );

  return v_result_version;
end;
$$;

revoke all on function public.workout_transfer_session_ownership(uuid, uuid, uuid, integer) from public, anon;
grant execute on function public.workout_transfer_session_ownership(uuid, uuid, uuid, integer) to authenticated;
