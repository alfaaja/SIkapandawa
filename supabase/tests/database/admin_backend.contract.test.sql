-- Contract matrix for the Sikapandawa admin read model and authorization.
-- Precondition: the historical baseline and admin backend migration have been
-- applied to the LOCAL Supabase stack. Never run this fixture against production.

begin;

create extension if not exists pgtap with schema extensions;

select plan(68);

-- Structural and privilege contract.
select has_schema('private', 'private schema exists');
select has_table('private', 'admin_users', 'admin role table exists');
select col_is_pk('private', 'admin_users', 'user_id', 'admin role is unique per user');
select has_table('public', 'admin_account_operations', 'service-only operation ledger exists');
select col_is_pk(
  'public',
  'admin_account_operations',
  'operation_id',
  'operation id is the idempotency key'
);
select has_column(
  'public',
  'admin_account_operations',
  'request_fingerprint',
  'ledger stores only a keyed request fingerprint'
);
select has_column(
  'public',
  'admin_account_operations',
  'status',
  'ledger stores operation lifecycle status'
);
select has_function('private', 'is_admin', array[]::text[], 'admin helper exists');
select is_definer('private', 'is_admin', array[]::text[], 'admin helper is security definer');
select has_function(
  'public',
  'admin_dashboard_summary',
  array[]::text[],
  'summary RPC exists'
);
select has_function(
  'public',
  'admin_list_users',
  array['text', 'text', 'integer', 'integer'],
  'list RPC exists'
);
select has_function(
  'public',
  'admin_get_user_progress',
  array['uuid'],
  'detail RPC exists'
);
select has_function(
  'public',
  'admin_begin_account_operation',
  array['uuid', 'uuid', 'text', 'uuid', 'text', 'text', 'jsonb'],
  'service-only operation begin RPC exists'
);
select has_function(
  'public',
  'admin_finish_account_operation',
  array['uuid', 'text', 'text', 'uuid'],
  'service-only operation finish RPC exists'
);
select has_function(
  'public',
  'admin_target_is_protected',
  array['uuid'],
  'service-only protected-target helper exists'
);
select ok(
  not has_function_privilege('anon', 'private.is_admin()', 'execute'),
  'anon cannot execute private.is_admin'
);
select ok(
  has_function_privilege('authenticated', 'private.is_admin()', 'execute'),
  'authenticated may resolve the policy helper'
);
select ok(
  not has_function_privilege('anon', 'public.admin_dashboard_summary()', 'execute'),
  'anon cannot execute summary RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.admin_dashboard_summary()', 'execute'),
  'authenticated may execute summary subject to explicit admin gate'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_begin_account_operation(uuid,uuid,text,uuid,text,text,jsonb)',
    'execute'
  ),
  'anon cannot begin an account operation'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.admin_begin_account_operation(uuid,uuid,text,uuid,text,text,jsonb)',
    'execute'
  ),
  'authenticated cannot begin an account operation directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.admin_begin_account_operation(uuid,uuid,text,uuid,text,text,jsonb)',
    'execute'
  ),
  'service role can begin an account operation'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.admin_target_is_protected(uuid)',
    'execute'
  ),
  'authenticated cannot probe protected admin targets'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.admin_target_is_protected(uuid)',
    'execute'
  ),
  'service role can protect admin targets before mutation'
);
select ok(
  not has_table_privilege('anon', 'private.admin_users', 'select'),
  'anon cannot read admin role table'
);
select ok(
  not has_table_privilege('authenticated', 'private.admin_users', 'select'),
  'authenticated cannot read admin role table'
);
select ok(
  not has_table_privilege('authenticated', 'public.admin_account_operations', 'select'),
  'authenticated cannot read audit/idempotency ledger'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.admin_account_operations',
    'insert'
  ),
  'authenticated cannot insert a forged audit operation'
);
select ok(
  (
    select c.relrowsecurity
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'admin_account_operations'
  ),
  'operation ledger has RLS enabled'
);
select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'player_progress', 'level_progress')
      and cmd = 'SELECT'
      and policyname like '%admin%'
  ),
  3,
  'exactly three admin SELECT policies exist'
);
select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'player_progress', 'level_progress')
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
      and policyname like '%admin%'
  ),
  0,
  'no admin write policy exists on player data'
);

-- Synthetic users. Existing signup trigger must create profile, aggregate
-- progress, and ten level rows for each fixture.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'ecc-admin@users.sikapandawa.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"ECC Admin","username":"ecc_contract_admin","normalized_username":"ecc_contract_admin"}',
    '2026-01-03 00:00:00+00',
    '2026-01-03 00:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'ecc-player-a@users.sikapandawa.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"ECC Player A","username":"ecc_contract_a","normalized_username":"ecc_contract_a"}',
    '2026-01-02 00:00:00+00',
    '2026-01-02 00:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'ecc-player-b@users.sikapandawa.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"ECC Player B","username":"ecc_contract_b","normalized_username":"ecc_contract_b"}',
    '2026-01-01 00:00:00+00',
    '2026-01-01 00:00:00+00'
  );

insert into private.admin_users (user_id)
values ('10000000-0000-4000-8000-000000000001');

create or replace function pg_temp.capture_sqlstate(statement text)
returns text
language plpgsql
as $$
begin
  execute statement;
  return null;
exception when others then
  return sqlstate;
end
$$;

-- Non-admin: owns one row, cannot enumerate or mutate somebody else's row.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);

select is(
  pg_temp.capture_sqlstate('select public.admin_dashboard_summary()'),
  '42501',
  'authenticated non-admin is denied by the summary RPC'
);
select is(
  (select count(*) from public.profiles),
  1::bigint,
  'player own-row profile SELECT still works'
);
select is(
  (select count(*) from public.level_progress),
  10::bigint,
  'player own-row level SELECT still works'
);
select is(
  pg_temp.capture_sqlstate(
    $$update public.profiles
         set display_name = 'Unauthorized'
       where id = '10000000-0000-4000-8000-000000000003'$$
  ),
  '42501',
  'player cannot update another profile'
);
select is(
  pg_temp.capture_sqlstate(
    $$insert into private.admin_users (user_id)
      values ('10000000-0000-4000-8000-000000000002')$$
  ),
  '42501',
  'player cannot self-assign the admin role'
);

-- Admin: read access only, validated RPCs, stable pagination, no sensitive data.
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

select ok(private.is_admin(), 'admin helper recognizes the fixture admin');
select is(
  (select count(*) from public.profiles where normalized_username like 'ecc_contract_%'),
  3::bigint,
  'admin RLS policy can see all contract fixtures'
);
select is(
  (public.admin_dashboard_summary() ->> 'totalUsers')::integer >= 3,
  true,
  'summary returns a total including fixtures'
);
select is(
  (
    public.admin_list_users('ecc_contract_', 'all', 25, 0)
      -> 'items' -> 0 ->> 'username'
  ),
  'ecc_contract_admin',
  'list ordering is registered_at desc with deterministic fixture result'
);
select is(
  (
    public.admin_list_users('ecc_contract_', 'not_started', 2, 0)
      ->> 'pageSize'
  )::integer,
  2,
  'list applies validated server-side page size'
);
select is(
  (
    select jsonb_array_length(
      public.admin_get_user_progress(
        '10000000-0000-4000-8000-000000000002'
      ) -> 'levels'
    )
  ),
  10,
  'detail returns exactly ten levels'
);
select is(
  (
    select array_agg((item ->> 'level')::integer order by ordinal)
    from jsonb_array_elements(
      public.admin_get_user_progress(
        '10000000-0000-4000-8000-000000000002'
      ) -> 'levels'
    ) with ordinality as levels(item, ordinal)
  ),
  array[1,2,3,4,5,6,7,8,9,10],
  'detail levels are ordered 1 through 10'
);
select ok(
  not (
    public.admin_get_user_progress(
      '10000000-0000-4000-8000-000000000002'
    )::text ~* '(password|access_token|refresh_token|@users\\.sikapandawa\\.invalid)'
  ),
  'detail response contains no password, token, or internal email'
);
select is(
  pg_temp.capture_sqlstate(
    $$select public.admin_list_users(null, 'unknown', 25, 0)$$
  ),
  '22023',
  'invalid progress filter is rejected'
);
select is(
  pg_temp.capture_sqlstate(
    $$select public.admin_list_users(null, 'all', 101, 0)$$
  ),
  '22023',
  'oversized page is rejected'
);
select is(
  pg_temp.capture_sqlstate(
    $$select public.admin_list_users(null, 'all', 25, -1)$$
  ),
  '22023',
  'negative offset is rejected'
);
select is(
  pg_temp.capture_sqlstate(
    $$select public.admin_get_user_progress(
      '10000000-0000-4000-8000-999999999999'
    )$$
  ),
  'P0002',
  'missing target returns the documented not-found SQLSTATE'
);
select is(
  pg_temp.capture_sqlstate(
    $$update public.profiles
         set display_name = 'Admin Browser Write'
       where id = '10000000-0000-4000-8000-000000000002'$$
  ),
  '42501',
  'admin browser remains unable to update another player profile'
);

-- Service-only idempotency ledger: same request replays, changed payload conflicts,
-- and finalized audit identity is immutable.
set local role service_role;

select is(
  public.admin_begin_account_operation(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'update',
    '10000000-0000-4000-8000-000000000002',
    'ecc_contract_a',
    'fixture-fingerprint-a',
    '{"changedFields":["displayName"]}'::jsonb
  ) ->> 'status',
  'pending',
  'first operation begin creates a pending ledger row'
);
select is(
  public.admin_begin_account_operation(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'update',
    '10000000-0000-4000-8000-000000000002',
    'ecc_contract_a',
    'fixture-fingerprint-a',
    '{"changedFields":["displayName"]}'::jsonb
  ) ->> 'status',
  'pending',
  'same operation and fingerprint replays the existing pending row'
);
select is(
  pg_temp.capture_sqlstate(
    $$select public.admin_begin_account_operation(
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      'update',
      '10000000-0000-4000-8000-000000000002',
      'ecc_contract_a',
      'different-fingerprint',
      '{"changedFields":["displayName"]}'::jsonb
    )$$
  ),
  '22023',
  'same operation id with a changed fingerprint is rejected'
);
select is(
  public.admin_finish_account_operation(
    '20000000-0000-4000-8000-000000000001',
    'succeeded',
    null,
    '10000000-0000-4000-8000-000000000002'
  ) ->> 'status',
  'succeeded',
  'finish operation records the terminal outcome'
);
select is(
  public.admin_begin_account_operation(
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'update',
    '10000000-0000-4000-8000-000000000002',
    'ecc_contract_a',
    'fixture-fingerprint-a',
    '{"changedFields":["displayName"]}'::jsonb
  ) ->> 'status',
  'succeeded',
  'retry after completion returns the stored success'
);
select is(
  pg_temp.capture_sqlstate(
    $$update public.admin_account_operations
         set actor_user_id = '10000000-0000-4000-8000-000000000003'
       where operation_id = '20000000-0000-4000-8000-000000000001'$$
  ),
  '22023',
  'audit actor is immutable after insertion'
);

-- Maintenance rate limits: an administrator may remove twelve stale accounts
-- in a rolling ten-minute window. Every claimed attempt consumes capacity,
-- including failed and still-pending operations. The older ledger row below
-- proves that the window is rolling rather than a lifetime counter.
insert into public.admin_account_operations (
  operation_id,
  actor_user_id,
  action,
  target_user_id,
  target_username,
  request_fingerprint,
  request_details,
  status,
  created_at,
  completed_at
) values (
  '30000000-0000-4000-8000-000000000000',
  '10000000-0000-4000-8000-000000000001',
  'delete',
  '10000000-0000-4000-8000-000000000003',
  'ecc_contract_b',
  'old-delete-fixture-fingerprint',
  '{}'::jsonb,
  'succeeded',
  now() - interval '11 minutes',
  now() - interval '11 minutes'
);

create or replace function pg_temp.seed_delete_rate_limit()
returns integer
language plpgsql
as $$
declare
  sequence integer;
  operation_id uuid;
begin
  for sequence in 1..12 loop
    operation_id := md5('delete-rate-limit-' || sequence::text)::uuid;
    perform public.admin_begin_account_operation(
      operation_id,
      '10000000-0000-4000-8000-000000000001',
      'delete',
      '10000000-0000-4000-8000-000000000003',
      'ecc_contract_b',
      md5('delete-rate-fingerprint-' || sequence::text),
      '{}'::jsonb
    );
    if sequence <= 4 then
      perform public.admin_finish_account_operation(
        operation_id,
        'succeeded',
        null,
        '10000000-0000-4000-8000-000000000003'
      );
    elsif sequence <= 8 then
      perform public.admin_finish_account_operation(
        operation_id,
        'failed',
        'fixture_failure',
        '10000000-0000-4000-8000-000000000003'
      );
    end if;
  end loop;
  return 12;
end
$$;

select is(
  pg_temp.seed_delete_rate_limit(),
  12,
  'twelve delete attempts are accepted inside the rolling window'
);
select is(
  (
    select count(*)::integer
    from public.admin_account_operations
    where actor_user_id = '10000000-0000-4000-8000-000000000001'
      and action = 'delete'
      and status = 'succeeded'
      and created_at >= now() - interval '10 minutes'
  ),
  4,
  'successful deletes consume maintenance capacity'
);
select is(
  (
    select count(*)::integer
    from public.admin_account_operations
    where actor_user_id = '10000000-0000-4000-8000-000000000001'
      and action = 'delete'
      and status = 'failed'
      and created_at >= now() - interval '10 minutes'
  ),
  4,
  'failed deletes consume maintenance capacity'
);
select is(
  (
    select count(*)::integer
    from public.admin_account_operations
    where actor_user_id = '10000000-0000-4000-8000-000000000001'
      and action = 'delete'
      and status = 'pending'
      and created_at >= now() - interval '10 minutes'
  ),
  4,
  'pending deletes consume maintenance capacity'
);
select is(
  (
    select count(*)::integer
    from public.admin_account_operations
    where actor_user_id = '10000000-0000-4000-8000-000000000001'
      and action = 'delete'
      and created_at >= now() - interval '10 minutes'
  ),
  12,
  'exactly twelve recent delete attempts fill the maintenance window'
);
select is(
  (
    select count(*)::integer
    from public.admin_account_operations
    where actor_user_id = '10000000-0000-4000-8000-000000000001'
      and action = 'delete'
  ),
  13,
  'a delete older than ten minutes is retained in the ledger but excluded from the window'
);
select is(
  pg_temp.capture_sqlstate(
    $$select public.admin_begin_account_operation(
      '30000000-0000-4000-8000-000000000013',
      '10000000-0000-4000-8000-000000000001',
      'delete',
      '10000000-0000-4000-8000-000000000003',
      'ecc_contract_b',
      'thirteenth-delete-fingerprint',
      '{}'::jsonb
    )$$
  ),
  'P0001',
  'the thirteenth recent delete attempt is rate limited'
);

create or replace function pg_temp.fill_action_rate_limit(
  requested_action text,
  expected_limit integer
)
returns integer
language plpgsql
as $$
declare
  existing_count integer;
  sequence integer;
begin
  select count(*)::integer into existing_count
  from public.admin_account_operations
  where actor_user_id = '10000000-0000-4000-8000-000000000001'
    and action = requested_action
    and created_at >= now() - interval '10 minutes';

  if existing_count < expected_limit then
    for sequence in (existing_count + 1)..expected_limit loop
      perform public.admin_begin_account_operation(
        md5('unchanged-limit-' || requested_action || '-' || sequence::text)::uuid,
        '10000000-0000-4000-8000-000000000001',
        requested_action,
        '10000000-0000-4000-8000-000000000002',
        'ecc_contract_a',
        md5('unchanged-fingerprint-' || requested_action || '-' || sequence::text),
        '{}'::jsonb
      );
    end loop;
  end if;

  select count(*)::integer into existing_count
  from public.admin_account_operations
  where actor_user_id = '10000000-0000-4000-8000-000000000001'
    and action = requested_action
    and created_at >= now() - interval '10 minutes';
  return existing_count;
end
$$;

select is(pg_temp.fill_action_rate_limit('create', 5), 5, 'create limit remains five attempts');
select is(
  pg_temp.capture_sqlstate(
    $$select public.admin_begin_account_operation(
      '31000000-0000-4000-8000-000000000006',
      '10000000-0000-4000-8000-000000000001',
      'create',
      '10000000-0000-4000-8000-000000000002',
      'ecc_contract_a',
      'sixth-create-rate-fingerprint',
      '{}'::jsonb
    )$$
  ),
  'P0001',
  'sixth create attempt remains rate limited'
);
select is(
  pg_temp.fill_action_rate_limit('reset_password', 5),
  5,
  'reset-password limit remains five attempts'
);
select is(
  pg_temp.capture_sqlstate(
    $$select public.admin_begin_account_operation(
      '32000000-0000-4000-8000-000000000006',
      '10000000-0000-4000-8000-000000000001',
      'reset_password',
      '10000000-0000-4000-8000-000000000002',
      'ecc_contract_a',
      'sixth-reset-rate-fingerprint',
      '{}'::jsonb
    )$$
  ),
  'P0001',
  'sixth reset-password attempt remains rate limited'
);
select is(pg_temp.fill_action_rate_limit('update', 20), 20, 'update limit remains twenty attempts');
select is(
  pg_temp.capture_sqlstate(
    $$select public.admin_begin_account_operation(
      '33000000-0000-4000-8000-000000000021',
      '10000000-0000-4000-8000-000000000001',
      'update',
      '10000000-0000-4000-8000-000000000002',
      'ecc_contract_a',
      'twenty-first-update-fingerprint',
      '{}'::jsonb
    )$$
  ),
  'P0001',
  'twenty-first update attempt remains rate limited'
);

reset role;

select * from finish();
rollback;
