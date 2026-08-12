begin;

select plan(11);

select has_function('public', 'workout_remote_abandon_session', ARRAY['uuid', 'uuid', 'integer'], 'Remote abandon RPC exists');

do $$
declare
  v_user uuid := 'abababab-abab-abab-abab-abababababab';
begin
  insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at)
  values (v_user, 'authenticated', 'authenticated', 'recovery-test@example.test', 'not-a-password', now())
  on conflict (id) do nothing;
end;
$$;

select set_config('request.jwt.claim.sub', 'abababab-abab-abab-abab-abababababab', true);
set local role authenticated;

select is(public.workout_register_device('10101010-1010-4010-8010-101010101010', 'Owner device')::text, '10101010-1010-4010-8010-101010101010', 'Owner device registers');
select is(public.workout_register_device('20202020-2020-4020-8020-202020202020', 'Recovery device')::text, '20202020-2020-4020-8020-202020202020', 'Non-owner recovery device registers');
select is(public.workout_start_adhoc('30303030-3030-4030-8030-303030303030', '10101010-1010-4010-8010-101010101010', null, null, 'Recovery Session')::text, '30303030-3030-4030-8030-303030303030', 'Recovery session starts');

select is(public.workout_remote_abandon_session('40404040-4040-4040-8040-404040404040', '30303030-3030-4030-8030-303030303030', 1), 2, 'Remote abandon closes an Active Session');
select is(public.workout_remote_abandon_session('40404040-4040-4040-8040-404040404040', '30303030-3030-4030-8030-303030303030', 1), 2, 'Remote abandon retry is idempotent');
select is((select status from public.workout_sessions where id = '30303030-3030-4030-8030-303030303030'), 'DISCARDED', 'Remote abandon does not leave Session Active');

select is(
  public.workout_remote_abandon_session('50505050-5050-4050-8050-505050505050', '30303030-3030-4030-8030-303030303030', 2),
  2,
  'A new abandon after a discarded terminal state returns the canonical version'
);

select is(public.workout_start_adhoc('60606060-6060-4060-8060-606060606060', '10101010-1010-4010-8010-101010101010', null, null, 'Completed Session')::text, '60606060-6060-4060-8060-606060606060', 'A second recovery session starts');
select is(public.workout_finish_session('60606060-6060-4060-8060-606060606060', '10101010-1010-4010-8010-101010101010', 1)::text, '60606060-6060-4060-8060-606060606060', 'The second recovery session completes');
select throws_ok(
  $$select public.workout_remote_abandon_session('70707070-7070-4070-8070-707070707070', '60606060-6060-4060-8060-606060606060', 2)$$,
  'session_not_active',
  'A completed Session cannot be remotely abandoned'
);

select * from finish();
rollback;
