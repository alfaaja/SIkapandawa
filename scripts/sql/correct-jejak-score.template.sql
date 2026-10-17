-- Operator-only, reviewed data repair. Replace all __TOKENS__ before execution.
-- Use apply_migration for this operation because two named triggers are toggled.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
lock table public.player_progress in access exclusive mode;
do $$
declare target uuid; prior public.player_progress; repaired public.player_progress;
  other_before text; levels_before text; monitoring_before text; profiles_before text; runs_before text;
begin
  select p.id into strict target from public.profiles p
   where p.normalized_username = '__NORMALIZED_USERNAME__'
     and p.school_name = '__SCHOOL_NAME__' and not private.admin_profile_is_admin(p.id);
  select * into strict prior from public.player_progress where user_id = target for update;
  if prior.jejak_pandawa_best_score <> __EXPECTED_SCORE__ or prior.revision <> __EXPECTED_REVISION__
     or not prior.jejak_pandawa_unlocked then
    raise exception 'Target changed since preview; abort and review again';
  end if;
  if exists(select 1 from public.jejak_aspect_runs where user_id = target)
     or exists(select 1 from private.jejak_score_corrections where user_id = target) then
    raise exception 'Existing detailed run or correction requires separate review';
  end if;
  if (select count(*) from pg_trigger where tgrelid = 'public.player_progress'::regclass
      and tgname in ('player_progress_guard_monotonic','player_progress_guard_aspects') and tgenabled = 'O') <> 2 then
    raise exception 'Expected normal progress guards are missing';
  end if;
  select md5(coalesce(jsonb_agg(to_jsonb(p) order by user_id), '[]'::jsonb)::text) into other_before
    from public.player_progress p where user_id <> target;
  select md5(coalesce(jsonb_agg(to_jsonb(l) order by user_id,level), '[]'::jsonb)::text) into levels_before from public.level_progress l;
  select md5(coalesce(jsonb_agg(to_jsonb(m) order by id), '[]'::jsonb)::text) into monitoring_before from public.parent_monitoring_observations m;
  select md5(coalesce(jsonb_agg(to_jsonb(p) order by id), '[]'::jsonb)::text) into profiles_before from public.profiles p;
  select md5(coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb)::text) into runs_before from public.jejak_aspect_runs r;
  insert into private.jejak_score_corrections(user_id,corrected_score,before_progress,reason)
    values(target,__CORRECTED_SCORE__,to_jsonb(prior),'__REASON__');
  alter table public.player_progress disable trigger player_progress_guard_monotonic;
  alter table public.player_progress disable trigger player_progress_guard_aspects;
  update public.player_progress set jejak_pandawa_best_score = __CORRECTED_SCORE__,
    jejak_aspect_scores = null, revision = prior.revision + 1, updated_at = clock_timestamp() where user_id = target;
  alter table public.player_progress enable trigger player_progress_guard_aspects;
  alter table public.player_progress enable trigger player_progress_guard_monotonic;
  select * into strict repaired from public.player_progress where user_id = target;
  if repaired.jejak_pandawa_best_score <> __CORRECTED_SCORE__ or repaired.jejak_aspect_scores is not null
    or repaired.revision <> prior.revision + 1
    or (to_jsonb(repaired) - array['jejak_pandawa_best_score','jejak_aspect_scores','revision','updated_at'])
      is distinct from (to_jsonb(prior) - array['jejak_pandawa_best_score','jejak_aspect_scores','revision','updated_at'])
    or other_before is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(p) order by user_id),'[]'::jsonb)::text) from public.player_progress p where user_id <> target)
    or levels_before is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(l) order by user_id,level),'[]'::jsonb)::text) from public.level_progress l)
    or monitoring_before is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(m) order by id),'[]'::jsonb)::text) from public.parent_monitoring_observations m)
    or profiles_before is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(p) order by id),'[]'::jsonb)::text) from public.profiles p)
    or runs_before is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(r) order by id),'[]'::jsonb)::text) from public.jejak_aspect_runs r) then
    raise exception 'Repair affected unexpected data; transaction rolled back';
  end if;
end $$;
commit;
