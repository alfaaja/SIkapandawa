-- Keep destructive account cleanup bounded while allowing a supervised
-- maintenance session to remove more than three confirmed accounts.
create or replace function public.admin_begin_account_operation(
  operation_id uuid,
  actor_user_id uuid,
  action text,
  target_user_id uuid,
  target_username text,
  request_fingerprint text,
  request_details jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing public.admin_account_operations%rowtype;
  recent_count integer;
  action_limit integer;
begin
  if operation_id is null or actor_user_id is null then
    raise exception using errcode = '22023', message = 'Invalid operation identity';
  end if;
  if action not in ('create', 'update', 'reset_password', 'delete') then
    raise exception using errcode = '22023', message = 'Invalid operation action';
  end if;
  if not exists (
    select 1 from private.admin_users where user_id = actor_user_id
  ) then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;
  if request_details::text ~* '(password|access_token|refresh_token|authorization|email)' then
    raise exception using errcode = '22023', message = 'Sensitive operation details are forbidden';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_user_id::text || ':' || action, 0)
  );

  select * into existing
  from public.admin_account_operations
  where admin_account_operations.operation_id = admin_begin_account_operation.operation_id;
  if found then
    if existing.actor_user_id is distinct from actor_user_id
       or existing.action is distinct from action
       or existing.target_user_id is distinct from target_user_id
       or existing.target_username is distinct from target_username
       or existing.request_fingerprint is distinct from request_fingerprint then
      raise exception using errcode = '22023', message = 'Idempotency key conflict';
    end if;
    return jsonb_build_object(
      'operationId', existing.operation_id,
      'status', existing.status,
      'targetUserId', existing.target_user_id,
      'errorCode', existing.error_code,
      'replayed', true
    );
  end if;

  action_limit := case action
    when 'delete' then 12
    when 'create' then 5
    when 'reset_password' then 5
    else 20
  end;
  select count(*)::integer into recent_count
  from public.admin_account_operations
  where admin_account_operations.actor_user_id = admin_begin_account_operation.actor_user_id
    and admin_account_operations.action = admin_begin_account_operation.action
    and created_at >= now() - interval '10 minutes';
  if recent_count >= action_limit then
    raise exception using errcode = 'P0001', message = 'Rate limit exceeded';
  end if;

  insert into public.admin_account_operations (
    operation_id,
    actor_user_id,
    action,
    target_user_id,
    target_username,
    request_fingerprint,
    request_details
  ) values (
    operation_id,
    actor_user_id,
    action,
    target_user_id,
    btrim(target_username),
    request_fingerprint,
    coalesce(request_details, '{}'::jsonb)
  ) returning * into existing;

  return jsonb_build_object(
    'operationId', existing.operation_id,
    'status', existing.status,
    'targetUserId', existing.target_user_id,
    'errorCode', existing.error_code,
    'replayed', false
  );
end
$$;

revoke all on function public.admin_begin_account_operation(uuid, uuid, text, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_begin_account_operation(uuid, uuid, text, uuid, text, text, jsonb)
  to service_role;

comment on function public.admin_begin_account_operation(uuid, uuid, text, uuid, text, text, jsonb) is
  'Claims idempotent admin account operations with per-action rolling rate limits; delete allows 12 confirmed operations per 10 minutes.';
