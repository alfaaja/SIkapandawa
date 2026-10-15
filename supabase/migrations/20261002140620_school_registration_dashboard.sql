begin;

-- Canonical whitespace/case keeps one school in one filter and chart group.
create or replace function private.normalize_school_name(value text)
returns text language sql immutable security invoker set search_path = '' as $$
  select case when name = 'SDN KALIBANTENG KULON 01'
    then 'SDN Kalibanteng Kulon 01' else nullif(name, '') end
  from (select upper(regexp_replace(btrim(normalize(value, NFKC)), '[[:space:]]+', ' ', 'g')) as name) as normalized
$$;
revoke all on function private.normalize_school_name(text) from public, anon, authenticated, service_role;
grant execute on function private.normalize_school_name(text) to authenticated, service_role;

alter table public.profiles add column school_name text;
-- All profiles predating this migration belong to the school specified by the owner.
update public.profiles set school_name = 'SDN Kalibanteng Kulon 01';
alter table public.profiles alter column school_name set not null;
alter table public.profiles alter column school_name set default 'SDN Kalibanteng Kulon 01';
alter table public.profiles add constraint profiles_school_name_check check (
  char_length(school_name) between 2 and 100
  and school_name !~ '[[:cntrl:]]'
  and school_name = private.normalize_school_name(school_name)
);
create index profiles_school_registered_idx on public.profiles (school_name, created_at desc, id desc);
comment on column public.profiles.school_name is 'Canonical school name; existing accounts backfilled to SDN Kalibanteng Kulon 01.';

-- Only an authenticated admin can inspect membership; the table remains private.
create or replace function private.admin_profile_is_admin(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select private.is_admin()), false)
    and exists (select 1 from private.admin_users as admins where admins.user_id = target_user_id)
$$;
revoke all on function private.admin_profile_is_admin(uuid) from public, anon, authenticated, service_role;
grant execute on function private.admin_profile_is_admin(uuid) to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_school_name text;
  profile_display_name text;
  profile_username text;
  profile_normalized_username text;
begin
  profile_school_name := private.normalize_school_name(coalesce(new.raw_user_meta_data ->> 'school_name', 'SDN Kalibanteng Kulon 01'));
  if profile_school_name is null or char_length(profile_school_name) not between 2 and 100
     or profile_school_name ~ '[[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'Invalid school name';
  end if;
  profile_display_name := btrim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    ''
  ));
  profile_username := btrim(coalesce(
    new.raw_user_meta_data ->> 'username',
    ''
  ));
  profile_normalized_username := coalesce(
    new.raw_user_meta_data ->> 'normalized_username',
    ''
  );

  if char_length(profile_display_name) not between 2 and 24 then
    raise exception using
      errcode = '22023',
      message = 'Invalid display name';
  end if;
  if char_length(profile_username) not between 3 and 20 then
    raise exception using
      errcode = '22023',
      message = 'Invalid username';
  end if;
  if profile_normalized_username <> lower(profile_username)
     or profile_normalized_username !~ '^[a-z0-9._-]{3,20}$' then
    raise exception using
      errcode = '22023',
      message = 'Invalid normalized username';
  end if;

  insert into public.profiles (
    id,
    display_name,
    school_name,
    username,
    normalized_username,
    created_at,
    updated_at
  )
  values (
    new.id,
    profile_display_name,
    profile_school_name,
    profile_username,
    profile_normalized_username,
    coalesce(new.created_at, now()),
    now()
  );

  insert into public.player_progress (user_id)
  values (new.id);

  insert into public.level_progress (
    user_id,
    level,
    stars,
    completed,
    updated_at
  )
  select new.id, generated_level, 0, false, now()
    from generate_series(1, 10) as generated_level;

  return new;
end
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated, service_role;

-- Replace signatures atomically; defaults keep older no-school callers working.
-- Remove the old overloads so PostgREST can resolve default arguments unambiguously.
drop function public.admin_dashboard_summary();
drop function public.admin_list_users(text, text, integer, integer);
create or replace function public.admin_dashboard_summary(school_name text default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  normalized_school text := private.normalize_school_name(school_name);
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
    where normalized_school is null or profiles.school_name = normalized_school
  )
  select jsonb_build_object(
    'schools', (select coalesce(jsonb_agg(schools.school_name order by schools.school_name), '[]'::jsonb) from (select distinct profiles.school_name from public.profiles as profiles) as schools),
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
  page_offset integer default 0,
  school_name text default null
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
  normalized_school text := private.normalize_school_name(school_name);
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
      profiles.school_name,
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
    from read_model as users
    where (
      normalized_search = ''
      or position(lower(normalized_search) in lower(display_name)) > 0
      or position(lower(normalized_search) in lower(username)) > 0
    )
    and (normalized_status = 'all' or status = normalized_status)
    and (normalized_school is null or users.school_name = normalized_school)
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
        'isAdmin', private.admin_profile_is_admin(page.user_id),
        'displayName', page.display_name,
        'schoolName', page.school_name,
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
revoke all on function public.admin_dashboard_summary(text) from public, anon, authenticated;
revoke all on function public.admin_list_users(text, text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.admin_dashboard_summary(text) to authenticated;
grant execute on function public.admin_list_users(text, text, integer, integer, text) to authenticated;

notify pgrst, 'reload schema';
commit;
