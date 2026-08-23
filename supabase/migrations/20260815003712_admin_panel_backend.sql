begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table private.admin_users enable row level security;
revoke all on table private.admin_users from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
grant select on table private.admin_users to service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.admin_users as admins
    where admins.user_id = (select auth.uid())
  )
$$;

revoke all on function private.is_admin() from public, anon, authenticated, service_role;
grant execute on function private.is_admin() to authenticated;

comment on table private.admin_users is
  'Server-managed admin membership. Never exposed through the Data API.';
comment on function private.is_admin() is
  'Returns admin membership for auth.uid(); caller cannot supply another identity.';

create policy profiles_select_admin
on public.profiles
for select
to authenticated
using ((select private.is_admin()));

create policy player_progress_select_admin
on public.player_progress
for select
to authenticated
using ((select private.is_admin()));

create policy level_progress_select_admin
on public.level_progress
for select
to authenticated
using ((select private.is_admin()));

create index profiles_admin_registered_order_idx
  on public.profiles (created_at desc, id desc);

create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;

  with level_totals as (
    select
      progress.user_id,
      count(*) filter (where progress.completed)::integer as completed_count,
      coalesce(sum(progress.stars), 0)::integer as total_stars
    from public.level_progress as progress
    group by progress.user_id
  ), classified as (
    select
      profiles.id,
      coalesce(level_totals.completed_count, 0) as completed_count,
      coalesce(level_totals.total_stars, 0) as total_stars
    from public.profiles as profiles
    left join level_totals on level_totals.user_id = profiles.id
  )
  select jsonb_build_object(
    'totalUsers', count(*)::integer,
    'notStartedUsers', count(*) filter (where completed_count = 0)::integer,
    'inProgressUsers', count(*) filter (where completed_count between 1 and 9)::integer,
    'completedUsers', count(*) filter (where completed_count >= 10)::integer,
    'totalStarsEarned', coalesce(sum(total_stars), 0)::integer,
    'generatedAt', now()
  )
  into result
  from classified;

  return result;
end
$$;

create or replace function public.admin_list_users(
  search_text text default null,
  progress_status text default 'all',
  page_size integer default 25,
  page_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  normalized_search text := btrim(coalesce(search_text, ''));
  normalized_status text := lower(btrim(coalesce(progress_status, 'all')));
  normalized_page_size integer := coalesce(page_size, 25);
  normalized_page_offset integer := coalesce(page_offset, 0);
  result jsonb;
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;
  if char_length(normalized_search) > 80 then
    raise exception using errcode = '22023', message = 'Invalid search';
  end if;
  if normalized_status not in ('all', 'not_started', 'in_progress', 'completed') then
    raise exception using errcode = '22023', message = 'Invalid progress status';
  end if;
  if normalized_page_size not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Invalid page size';
  end if;
  if normalized_page_offset < 0 then
    raise exception using errcode = '22023', message = 'Invalid page offset';
  end if;

  with level_totals as (
    select
      progress.user_id,
      count(*) filter (where progress.completed)::integer as completed_count,
      coalesce(sum(progress.stars), 0)::integer as total_stars,
      max(progress.updated_at) as latest_level_update
    from public.level_progress as progress
    group by progress.user_id
  ), read_model as (
    select
      profiles.id as user_id,
      profiles.display_name,
      profiles.username,
      profiles.created_at as registered_at,
      coalesce(player.highest_unlocked_level, 1)::integer as highest_unlocked_level,
      coalesce(level_totals.completed_count, 0)::integer as completed_level_count,
      coalesce(level_totals.total_stars, 0)::integer as total_stars,
      coalesce(player.jejak_pandawa_unlocked, false) as jejak_pandawa_unlocked,
      coalesce(player.jejak_pandawa_best_score, 0)::integer as jejak_pandawa_best_score,
      greatest(
        profiles.updated_at,
        player.updated_at,
        level_totals.latest_level_update
      ) as progress_updated_at,
      case
        when coalesce(level_totals.completed_count, 0) = 0 then 'not_started'
        when coalesce(level_totals.completed_count, 0) >= 10 then 'completed'
        else 'in_progress'
      end as status
    from public.profiles as profiles
    left join public.player_progress as player on player.user_id = profiles.id
    left join level_totals on level_totals.user_id = profiles.id
  ), filtered as (
    select *
    from read_model
    where (
      normalized_search = ''
      or position(lower(normalized_search) in lower(display_name)) > 0
      or position(lower(normalized_search) in lower(username)) > 0
    )
    and (normalized_status = 'all' or status = normalized_status)
  ), page as (
    select *
    from filtered
    order by registered_at desc, user_id desc
    limit normalized_page_size
    offset normalized_page_offset
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', page.user_id,
        'displayName', page.display_name,
        'username', page.username,
        'registeredAt', page.registered_at,
        'highestUnlockedLevel', page.highest_unlocked_level,
        'completedLevelCount', page.completed_level_count,
        'totalStars', page.total_stars,
        'jejakPandawaUnlocked', page.jejak_pandawa_unlocked,
        'jejakPandawaBestScore', page.jejak_pandawa_best_score,
        'progressUpdatedAt', page.progress_updated_at,
        'status', page.status
      ) order by page.registered_at desc, page.user_id desc)
      from page
    ), '[]'::jsonb),
    'total', (select count(*)::integer from filtered),
    'pageSize', normalized_page_size,
    'pageOffset', normalized_page_offset
  )
  into result;

  return result;
end
$$;

create or replace function public.admin_get_user_progress(target_user_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  target_profile public.profiles%rowtype;
  target_progress public.player_progress%rowtype;
  completed_count integer;
  total_stars integer;
  result jsonb;
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;
  if target_user_id is null then
    raise exception using errcode = '22023', message = 'Invalid target';
  end if;

  select * into target_profile
  from public.profiles
  where id = target_user_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Player not found';
  end if;

  select * into target_progress
  from public.player_progress
  where user_id = target_user_id;

  select
    count(*) filter (where completed)::integer,
    coalesce(sum(stars), 0)::integer
  into completed_count, total_stars
  from public.level_progress
  where user_id = target_user_id;

  select jsonb_build_object(
    'user', jsonb_build_object(
      'userId', target_profile.id,
      'displayName', target_profile.display_name,
      'username', target_profile.username
    ),
    'summary', jsonb_build_object(
      'completedLevelCount', completed_count,
      'totalStars', total_stars,
      'averageStars', round(total_stars::numeric / 10, 2),
      'grade', case
        when total_stars >= 25 then 'Ksatria Sejati'
        when total_stars >= 19 then 'Calon Ksatria Hebat'
        when total_stars >= 13 then 'Teman yang Baik'
        when total_stars >= 7 then 'Terus Belajar'
        else 'Awal Perjalanan'
      end,
      'highestUnlockedLevel', coalesce(target_progress.highest_unlocked_level, 1),
      'introSeen', to_jsonb(coalesce(target_progress.intro_seen, '{}'::text[])),
      'jejakPandawaUnlocked', coalesce(target_progress.jejak_pandawa_unlocked, false),
      'jejakPandawaBestScore', coalesce(target_progress.jejak_pandawa_best_score, 0),
      'jejakTier', case
        when coalesce(target_progress.jejak_pandawa_best_score, 0) >= 8 then 'Luar Biasa'
        when coalesce(target_progress.jejak_pandawa_best_score, 0) >= 5 then 'Bagus'
        else 'Jangan Menyerah'
      end
    ),
    'levels', (
      select jsonb_agg(jsonb_build_object(
        'level', generated.level,
        'stars', coalesce(progress.stars, 0),
        'completed', coalesce(progress.completed, false),
        'updatedAt', coalesce(progress.updated_at, target_profile.created_at)
      ) order by generated.level)
      from generate_series(1, 10) as generated(level)
      left join public.level_progress as progress
        on progress.user_id = target_user_id
       and progress.level = generated.level
    )
  ) into result;

  return result;
end
$$;

revoke all on function public.admin_dashboard_summary() from public, anon, authenticated;
revoke all on function public.admin_list_users(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_get_user_progress(uuid) from public, anon, authenticated;
grant execute on function public.admin_dashboard_summary() to authenticated;
grant execute on function public.admin_list_users(text, text, integer, integer) to authenticated;
grant execute on function public.admin_get_user_progress(uuid) to authenticated;

comment on function public.admin_dashboard_summary() is
  'Admin-only aggregate dashboard read model; returns no auth metadata.';
comment on function public.admin_list_users(text, text, integer, integer) is
  'Admin-only validated search, filter, and offset pagination read model.';
comment on function public.admin_get_user_progress(uuid) is
  'Admin-only player report with exactly ten ordered level rows.';

create table public.admin_account_operations (
  operation_id uuid primary key,
  actor_user_id uuid not null,
  action text not null check (action in ('create', 'update', 'reset_password', 'delete')),
  target_user_id uuid,
  target_username text not null,
  request_fingerprint text not null check (char_length(request_fingerprint) between 16 and 256),
  request_details jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint admin_account_operations_terminal_time_check check (
    (status = 'pending' and completed_at is null)
    or (status in ('succeeded', 'failed') and completed_at is not null)
  )
);

alter table public.admin_account_operations enable row level security;
revoke all on table public.admin_account_operations from public, anon, authenticated;
grant select, insert, update on table public.admin_account_operations to service_role;
create index admin_account_operations_actor_created_idx
  on public.admin_account_operations (actor_user_id, created_at desc);
create index admin_account_operations_target_created_idx
  on public.admin_account_operations (target_user_id, created_at desc)
  where target_user_id is not null;

create or replace function private.guard_admin_account_operation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.operation_id is distinct from old.operation_id
     or new.actor_user_id is distinct from old.actor_user_id
     or new.action is distinct from old.action
     or new.target_username is distinct from old.target_username
     or new.request_fingerprint is distinct from old.request_fingerprint
     or new.request_details is distinct from old.request_details then
    raise exception using errcode = '22023', message = 'Operation identity is immutable';
  end if;
  if old.status <> 'pending' or new.status not in ('succeeded', 'failed') then
    raise exception using errcode = '22023', message = 'Invalid operation transition';
  end if;
  new.created_at := old.created_at;
  new.completed_at := now();
  return new;
end
$$;

create trigger admin_account_operations_guard
before update on public.admin_account_operations
for each row execute function private.guard_admin_account_operation();
revoke all on function private.guard_admin_account_operation() from public, anon, authenticated, service_role;

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
    when 'delete' then 3
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

create or replace function public.admin_finish_account_operation(
  operation_id uuid,
  final_status text,
  error_code text,
  resulting_target_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result public.admin_account_operations%rowtype;
begin
  if final_status not in ('succeeded', 'failed') then
    raise exception using errcode = '22023', message = 'Invalid final status';
  end if;
  update public.admin_account_operations
  set status = admin_finish_account_operation.final_status,
      error_code = case
        when admin_finish_account_operation.final_status = 'failed'
          then left(admin_finish_account_operation.error_code, 64)
        else null
      end,
      target_user_id = coalesce(
        admin_account_operations.target_user_id,
        admin_finish_account_operation.resulting_target_user_id
      )
  where admin_account_operations.operation_id = admin_finish_account_operation.operation_id
    and admin_account_operations.status = 'pending'
  returning * into result;
  if not found then
    select * into result
    from public.admin_account_operations
    where admin_account_operations.operation_id = admin_finish_account_operation.operation_id;
  end if;
  if not found then
    raise exception using errcode = 'P0002', message = 'Operation not found';
  end if;
  return jsonb_build_object(
    'operationId', result.operation_id,
    'status', result.status,
    'targetUserId', result.target_user_id,
    'errorCode', result.error_code
  );
end
$$;

create or replace function public.admin_target_is_protected(target_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from private.admin_users where user_id = target_user_id
  )
$$;

create or replace function private.revoke_user_sessions(target_user_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from auth.sessions where user_id = target_user_id
$$;

revoke all on function private.revoke_user_sessions(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.revoke_user_sessions(uuid) to service_role;

create or replace function public.admin_revoke_user_sessions(target_user_id uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if target_user_id is null then
    raise exception using errcode = '22023', message = 'Invalid target';
  end if;
  perform private.revoke_user_sessions(target_user_id);
end
$$;

revoke all on function public.admin_begin_account_operation(uuid, uuid, text, uuid, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.admin_finish_account_operation(uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.admin_target_is_protected(uuid)
  from public, anon, authenticated;
revoke all on function public.admin_revoke_user_sessions(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_begin_account_operation(uuid, uuid, text, uuid, text, text, jsonb)
  to service_role;
grant execute on function public.admin_finish_account_operation(uuid, text, text, uuid)
  to service_role;
grant execute on function public.admin_target_is_protected(uuid)
  to service_role;
grant execute on function public.admin_revoke_user_sessions(uuid)
  to service_role;

comment on table public.admin_account_operations is
  'Service-only idempotency, rate-limit, and sanitized audit ledger for admin account mutations.';
comment on function public.admin_begin_account_operation(uuid, uuid, text, uuid, text, text, jsonb) is
  'Claims a mutation idempotency key after verifying the actor is still an admin.';

commit;
