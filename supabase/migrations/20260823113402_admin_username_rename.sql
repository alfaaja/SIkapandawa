begin;

alter table public.admin_account_operations
  drop constraint if exists admin_account_operations_action_check,
  add constraint admin_account_operations_action_check
    check (action in ('create', 'update', 'rename_username', 'reset_password', 'delete'));

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
  if action not in ('create', 'update', 'rename_username', 'reset_password', 'delete') then
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
    when 'rename_username' then 5
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

create or replace function private.guard_profile_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception using
      errcode = '22023',
      message = 'Profile identity fields are immutable';
  end if;

  if (
    new.username is distinct from old.username
    or new.normalized_username is distinct from old.normalized_username
  ) and not (
    current_user = 'service_role'
    and coalesce(current_setting('app.admin_identity_rename', true), '') = 'on'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Profile identity fields are immutable';
  end if;

  new.display_name := btrim(new.display_name);
  new.created_at := old.created_at;
  if new.display_name is distinct from old.display_name
     or new.username is distinct from old.username
     or new.normalized_username is distinct from old.normalized_username then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end
$$;

create or replace function public.admin_service_update_profile_identity(
  target_user_id uuid,
  expected_username text,
  new_display_name text,
  new_username text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_profile public.profiles%rowtype;
  normalized_expected_username text := lower(btrim(coalesce(expected_username, '')));
  normalized_new_username text := lower(btrim(coalesce(new_username, '')));
  trimmed_display_name text := btrim(coalesce(new_display_name, ''));
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service access required';
  end if;
  if target_user_id is null then
    raise exception using errcode = '22023', message = 'Invalid target';
  end if;
  if normalized_expected_username !~ '^[a-z0-9._-]{3,20}$' then
    raise exception using errcode = '22023', message = 'Invalid expected username';
  end if;
  if btrim(coalesce(new_username, '')) <> normalized_new_username
     or normalized_new_username !~ '^[a-z0-9._-]{3,20}$' then
    raise exception using errcode = '22023', message = 'Invalid username';
  end if;
  if char_length(trimmed_display_name) not between 2 and 24 then
    raise exception using errcode = '22023', message = 'Invalid display name';
  end if;
  if exists (
    select 1
    from private.admin_users
    where user_id = target_user_id
  ) then
    raise exception using errcode = '42501', message = 'Protected account';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('admin-profile-identity:' || target_user_id::text, 0)
  );

  select * into current_profile
  from public.profiles
  where id = target_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Player not found';
  end if;
  if current_profile.normalized_username <> normalized_expected_username then
    raise exception using errcode = '40001', message = 'Profile changed; refresh and retry';
  end if;

  perform pg_catalog.set_config('app.admin_identity_rename', 'on', true);
  update public.profiles
  set display_name = trimmed_display_name,
      username = normalized_new_username,
      normalized_username = normalized_new_username
  where id = target_user_id
  returning * into current_profile;

  return jsonb_build_object(
    'userId', current_profile.id,
    'displayName', current_profile.display_name,
    'username', current_profile.username,
    'updatedAt', current_profile.updated_at
  );
end
$$;

revoke all on function public.admin_begin_account_operation(uuid, uuid, text, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_begin_account_operation(uuid, uuid, text, uuid, text, text, jsonb)
  to service_role;

revoke all on function private.guard_profile_identity()
  from public, anon, authenticated, service_role;

revoke all on function public.admin_service_update_profile_identity(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_service_update_profile_identity(uuid, text, text, text)
  to service_role;

comment on function public.admin_service_update_profile_identity(uuid, text, text, text) is
  'Service-only optimistic profile identity rename; rejects protected admin accounts and preserves player progress.';

commit;
