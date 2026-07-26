begin;

-- P20 evolves the existing remote schema in place. The legacy content tables
-- are intentionally preserved and remain outside the frontend source of truth.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

-- Prevent a concurrent legacy signup from creating a partially shaped profile
-- while the nullable legacy columns are hardened.
lock table public.profiles in access exclusive mode;

do $$
begin
  if exists (select 1 from public.profiles) then
    raise exception
      'P20 expected profiles to be empty after the approved audit; aborting rather than guessing profile backfill values';
  end if;
end
$$;

alter table public.profiles
  add column display_name text,
  add column normalized_username text,
  add column updated_at timestamptz not null default now();

alter table public.profiles
  alter column username set not null,
  alter column created_at set not null;

alter table public.profiles
  add constraint profiles_display_name_length_check
    check (
      display_name = btrim(display_name)
      and char_length(display_name) between 2 and 24
    ),
  add constraint profiles_username_length_check
    check (
      username = btrim(username)
      and char_length(username) between 3 and 20
    ),
  add constraint profiles_normalized_username_check
    check (
      normalized_username = lower(btrim(username))
      and normalized_username ~ '^[a-z0-9._-]{3,20}$'
    );

alter table public.profiles
  alter column display_name set not null,
  alter column normalized_username set not null;

alter table public.profiles
  add constraint profiles_normalized_username_key unique (normalized_username);

create table public.player_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  highest_unlocked_level smallint not null default 1,
  intro_seen text[] not null default '{}'::text[],
  completed_levels smallint[] not null default '{}'::smallint[],
  jejak_pandawa_unlocked boolean not null default false,
  jejak_pandawa_best_score smallint not null default 0,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_progress_highest_unlocked_level_check
    check (highest_unlocked_level between 1 and 10),
  constraint player_progress_completed_levels_check
    check (
      cardinality(completed_levels) <= 10
      and completed_levels <@ array[1,2,3,4,5,6,7,8,9,10]::smallint[]
    ),
  constraint player_progress_jejak_best_score_check
    check (jejak_pandawa_best_score between 0 and 10),
  constraint player_progress_revision_check
    check (revision >= 0)
);

-- The audited legacy constraint allowed 1..15; P20 supports exactly 1..10.
alter table public.level_progress
  drop constraint level_progress_level_check,
  add constraint level_progress_level_check check (level between 1 and 10),
  alter column updated_at set not null;

create index minigame_result_user_id_idx
  on public.minigame_result (user_id);

create or replace function private.guard_profile_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.username is distinct from old.username
     or new.normalized_username is distinct from old.normalized_username then
    raise exception using
      errcode = '22023',
      message = 'Profile identity fields are immutable';
  end if;

  new.display_name := btrim(new.display_name);
  new.created_at := old.created_at;
  if new.display_name is distinct from old.display_name then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end
$$;

create trigger profiles_guard_identity
before update on public.profiles
for each row execute function private.guard_profile_identity();

create or replace function private.guard_player_progress()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_intro text[];
  normalized_completed smallint[];
  changed boolean;
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception using
      errcode = '22023',
      message = 'Progress ownership is immutable';
  end if;

  select coalesce(array_agg(distinct value order by value), '{}'::text[])
    into normalized_intro
    from unnest(
      case when tg_op = 'UPDATE'
        then old.intro_seen || new.intro_seen
        else new.intro_seen
      end
    ) as item(value)
   where value is not null and btrim(value) <> '';

  select coalesce(array_agg(distinct value order by value), '{}'::smallint[])
    into normalized_completed
    from unnest(
      case when tg_op = 'UPDATE'
        then old.completed_levels || new.completed_levels
        else new.completed_levels
      end
    ) as item(value)
   where value between 1 and 10;

  new.intro_seen := normalized_intro;
  new.completed_levels := normalized_completed;

  if tg_op = 'INSERT' then
    new.highest_unlocked_level := greatest(1, new.highest_unlocked_level);
    new.jejak_pandawa_best_score := greatest(0, new.jejak_pandawa_best_score);
    new.revision := greatest(0, new.revision);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());
  else
    new.highest_unlocked_level :=
      greatest(old.highest_unlocked_level, new.highest_unlocked_level);
    new.jejak_pandawa_unlocked :=
      old.jejak_pandawa_unlocked or new.jejak_pandawa_unlocked;
    new.jejak_pandawa_best_score :=
      greatest(old.jejak_pandawa_best_score, new.jejak_pandawa_best_score);
    new.created_at := old.created_at;

    changed :=
      new.highest_unlocked_level is distinct from old.highest_unlocked_level
      or new.intro_seen is distinct from old.intro_seen
      or new.completed_levels is distinct from old.completed_levels
      or new.jejak_pandawa_unlocked is distinct from old.jejak_pandawa_unlocked
      or new.jejak_pandawa_best_score is distinct from old.jejak_pandawa_best_score;

    if changed then
      new.revision := old.revision + 1;
      new.updated_at := now();
    else
      new.revision := old.revision;
      new.updated_at := old.updated_at;
    end if;
  end if;

  if new.jejak_pandawa_unlocked
     and not (
       new.completed_levels
       @> array[1,2,3,4,5,6,7,8,9,10]::smallint[]
     ) then
    raise exception using
      errcode = '23514',
      message = 'Jejak Pandawa requires all ten completed levels';
  end if;

  return new;
end
$$;

create trigger player_progress_guard_monotonic
before insert or update on public.player_progress
for each row execute function private.guard_player_progress();

create or replace function private.guard_level_progress()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
       or new.level is distinct from old.level then
      raise exception using
        errcode = '22023',
        message = 'Level progress identity is immutable';
    end if;

    new.stars := greatest(old.stars, new.stars);
    new.completed := old.completed or new.completed;
    if new.stars is distinct from old.stars
       or new.completed is distinct from old.completed then
      new.updated_at := now();
    else
      new.updated_at := old.updated_at;
    end if;
  else
    new.updated_at := coalesce(new.updated_at, now());
  end if;
  return new;
end
$$;

create trigger level_progress_guard_monotonic
before insert or update on public.level_progress
for each row execute function private.guard_level_progress();

-- Replace the single legacy signup trigger atomically. The privileged function
-- lives outside the exposed schema, validates signup metadata, and fully
-- qualifies every referenced object.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_display_name text;
  profile_username text;
  profile_normalized_username text;
begin
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
    username,
    normalized_username,
    created_at,
    updated_at
  )
  values (
    new.id,
    profile_display_name,
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

drop function if exists public.handle_new_user();

revoke all on function private.handle_new_user() from public, anon, authenticated, service_role;
revoke all on function private.guard_profile_identity() from public, anon, authenticated, service_role;
revoke all on function private.guard_player_progress() from public, anon, authenticated, service_role;
revoke all on function private.guard_level_progress() from public, anon, authenticated, service_role;

create or replace function public.read_complete_progress()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'highestUnlockedLevel', progress.highest_unlocked_level,
    'levelStars', coalesce(
      jsonb_object_agg(levels.level, levels.stars order by levels.level)
        filter (where levels.level is not null),
      '{}'::jsonb
    ),
    'introSeen', to_jsonb(progress.intro_seen),
    'completedLevels', to_jsonb(progress.completed_levels),
    'jejakPandawaUnlocked', progress.jejak_pandawa_unlocked,
    'jejakPandawaBestScore', progress.jejak_pandawa_best_score,
    'revision', progress.revision
  )
  from public.player_progress as progress
  left join public.level_progress as levels
    on levels.user_id = progress.user_id
  where progress.user_id = (select auth.uid())
  group by
    progress.user_id,
    progress.highest_unlocked_level,
    progress.intro_seen,
    progress.completed_levels,
    progress.jejak_pandawa_unlocked,
    progress.jejak_pandawa_best_score,
    progress.revision
$$;

create or replace function public.record_level_result(
  level_id smallint,
  run_stars smallint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  resulting_best smallint;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if level_id not between 1 and 10 then
    raise exception using errcode = '22023', message = 'Level must be between 1 and 10';
  end if;
  if run_stars not between 0 and 3 then
    raise exception using errcode = '22023', message = 'Stars must be between 0 and 3';
  end if;

  update public.level_progress
     set stars = greatest(stars, run_stars),
         completed = true
   where user_id = current_user_id
     and level = level_id
  returning stars into resulting_best;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Initial level progress row is missing';
  end if;

  update public.player_progress
     set completed_levels = array_append(completed_levels, level_id),
         highest_unlocked_level = greatest(
           highest_unlocked_level,
           case
             when resulting_best >= 1 then least(10, level_id + 1)
             else highest_unlocked_level
           end
         )
   where user_id = current_user_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Initial player progress row is missing';
  end if;

  return public.read_complete_progress();
end
$$;

create or replace function public.mark_intro_seen(character_id text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_character_id text := lower(btrim(character_id));
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if normalized_character_id !~ '^[a-z0-9_-]{1,32}$' then
    raise exception using errcode = '22023', message = 'Invalid character id';
  end if;

  update public.player_progress
     set intro_seen = array_append(intro_seen, normalized_character_id)
   where user_id = current_user_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Initial player progress row is missing';
  end if;

  return public.read_complete_progress();
end
$$;

create or replace function public.unlock_jejak_pandawa()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  update public.player_progress
     set jejak_pandawa_unlocked = true
   where user_id = current_user_id
     and completed_levels
       @> array[1,2,3,4,5,6,7,8,9,10]::smallint[];

  return public.read_complete_progress();
end
$$;

create or replace function public.record_jejak_result(run_score smallint)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if run_score not between 0 and 10 then
    raise exception using errcode = '22023', message = 'Jejak score must be between 0 and 10';
  end if;

  update public.player_progress
     set jejak_pandawa_best_score = greatest(
       jejak_pandawa_best_score,
       run_score
     )
   where user_id = current_user_id
     and jejak_pandawa_unlocked;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'Jejak Pandawa is locked';
  end if;

  return public.read_complete_progress();
end
$$;

-- Replace broad legacy RLS policies with explicit authenticated ownership.
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists lp_all_own on public.level_progress;
drop policy if exists questions_read on public.questions;
drop policy if exists cards_read on public.minigame_cards;
drop policy if exists mr_all_own on public.minigame_result;

alter table public.profiles enable row level security;
alter table public.player_progress enable row level security;
alter table public.level_progress enable row level security;
alter table public.questions enable row level security;
alter table public.minigame_cards enable row level security;
alter table public.minigame_result enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy player_progress_select_own
on public.player_progress
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy player_progress_update_own
on public.player_progress
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy level_progress_select_own
on public.level_progress
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy level_progress_update_own
on public.level_progress
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy questions_read_authenticated
on public.questions
for select
to authenticated
using (true);

create policy minigame_cards_read_authenticated
on public.minigame_cards
for select
to authenticated
using (true);

-- Data API grants are a separate security boundary from RLS.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.player_progress from anon, authenticated;
revoke all on table public.level_progress from anon, authenticated;
revoke all on table public.questions from anon, authenticated;
revoke all on table public.minigame_cards from anon, authenticated;
revoke all on table public.minigame_result from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select, update on table public.player_progress to authenticated;
grant select, update on table public.level_progress to authenticated;
grant select on table public.questions to authenticated;
grant select on table public.minigame_cards to authenticated;

grant all on table public.player_progress to service_role;

revoke all on function public.read_complete_progress() from public, anon;
revoke all on function public.record_level_result(smallint, smallint) from public, anon;
revoke all on function public.mark_intro_seen(text) from public, anon;
revoke all on function public.unlock_jejak_pandawa() from public, anon;
revoke all on function public.record_jejak_result(smallint) from public, anon;

grant execute on function public.read_complete_progress() to authenticated;
grant execute on function public.record_level_result(smallint, smallint) to authenticated;
grant execute on function public.mark_intro_seen(text) to authenticated;
grant execute on function public.unlock_jejak_pandawa() to authenticated;
grant execute on function public.record_jejak_result(smallint) to authenticated;

-- Prevent future objects from inheriting broad Data API privileges.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

comment on table public.player_progress is
  'P20 aggregate player progress. Mutations are monotonic and scoped by RLS.';
comment on function public.record_level_result(smallint, smallint) is
  'Atomically records completion, best stars, and the next unlocked level for auth.uid().';
comment on function public.mark_intro_seen(text) is
  'Adds one character intro id without removing previously seen intros.';
comment on function public.unlock_jejak_pandawa() is
  'Unlocks Jejak only after all ten mission levels are completed.';
comment on function public.record_jejak_result(smallint) is
  'Stores the monotonic Jejak best score for auth.uid().';

commit;
