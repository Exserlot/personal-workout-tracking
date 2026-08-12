-- M-04.4: explicit administrative recovery for a conflicted Active Session.
-- This does not advance a Routine and never deletes the client-local copy.
create or replace function public.workout_remote_abandon_session(
  p_operation_id uuid,
  p_session_id uuid,
  p_expected_version integer
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
begin
  if p_operation_id is null or p_session_id is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'invalid_remote_abandon_request';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_operation_id::text));
  v_hash := md5(concat_ws('|', p_session_id::text, p_expected_version::text, 'remote_abandon'));

  select * into v_receipt from public.mutation_receipts where operation_id = p_operation_id;
  if found then
    if v_receipt.user_id <> auth.uid()
       or v_receipt.aggregate_id <> p_session_id
       or v_receipt.request_hash <> v_hash then
      raise exception using errcode = 'P0001', message = 'operation_id_conflict';
    end if;
    return v_receipt.result_version;
  end if;

  select * into v_session from public.workout_sessions where id = p_session_id for update;
  if not found or v_session.user_id <> auth.uid() then
    raise exception using errcode = 'P0002', message = 'session_not_found';
  end if;
  if v_session.status = 'DISCARDED' then
    v_result_version := v_session.version;
    insert into public.mutation_receipts(operation_id, user_id, aggregate_type, aggregate_id, request_hash, result_version)
    values (p_operation_id, auth.uid(), 'WORKOUT_SESSION', p_session_id, v_hash, v_result_version);
    return v_result_version;
  end if;
  if v_session.status <> 'ACTIVE' then
    raise exception using errcode = 'P0001', message = 'session_not_active';
  end if;
  if v_session.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'revision_conflict';
  end if;

  update public.workout_sessions
     set status = 'DISCARDED', version = version + 1, edited_at = now(), updated_at = now()
   where id = p_session_id;

  select version into v_result_version from public.workout_sessions where id = p_session_id;
  insert into public.mutation_receipts(operation_id, user_id, aggregate_type, aggregate_id, request_hash, result_version)
  values (p_operation_id, auth.uid(), 'WORKOUT_SESSION', p_session_id, v_hash, v_result_version);
  return v_result_version;
end;
$$;

revoke all on function public.workout_remote_abandon_session(uuid, uuid, integer) from public, anon;
grant execute on function public.workout_remote_abandon_session(uuid, uuid, integer) to authenticated;
