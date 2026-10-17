-- Operator-only, owner-requested reset. Fill reviewed snapshot tokens first.
-- Run with apply_migration: named guards are toggled only inside this transaction.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '20s';
lock table public.profiles in share mode;
lock table private.admin_users in share mode;
lock table public.jejak_aspect_runs in share mode;
lock table public.player_progress in access exclusive mode;
lock table private.jejak_score_corrections in share row exclusive mode;
create temporary table legacy_jejak_reset_targets on commit drop as
 select p.* from public.player_progress p
 where p.jejak_pandawa_best_score > 0
 and not exists (select 1 from private.admin_users a where a.user_id=p.user_id)
 and not exists (select 1 from public.jejak_aspect_runs r where r.user_id=p.user_id);
do $$
declare untouched_before text; levels_before text; profiles_before text; monitoring_before text;
begin
 if (select md5(coalesce(jsonb_agg(to_jsonb(p) order by user_id),'[]'::jsonb)::text) from public.player_progress p) <> '__PROGRESS_HASH__'
 or (select md5(coalesce(jsonb_agg(to_jsonb(r) order by id),'[]'::jsonb)::text) from public.jejak_aspect_runs r) <> '__RUNS_HASH__'
 or (select md5(coalesce(jsonb_agg(to_jsonb(c) order by user_id),'[]'::jsonb)::text) from private.jejak_score_corrections c) <> '__CORRECTIONS_HASH__'
 or (select count(*) from legacy_jejak_reset_targets) <> __TARGET_COUNT__ then
  raise exception 'Snapshot changed; abort reset and review a fresh backup';
 end if;
 if (select count(*) from pg_trigger where tgrelid='public.player_progress'::regclass and not tgisinternal
   and tgname in ('player_progress_guard_monotonic','player_progress_guard_aspects','player_progress_00_guard_corrected_jejak_total') and tgenabled='O') <> 3 then
  raise exception 'Expected enabled progress guards missing';
 end if;
 select md5(coalesce(jsonb_agg(to_jsonb(p) order by user_id),'[]'::jsonb)::text) into untouched_before
  from public.player_progress p where not exists(select 1 from legacy_jejak_reset_targets t where t.user_id=p.user_id);
 select md5(coalesce(jsonb_agg(to_jsonb(l) order by user_id,level),'[]'::jsonb)::text) into levels_before from public.level_progress l;
 select md5(coalesce(jsonb_agg(to_jsonb(p) order by id),'[]'::jsonb)::text) into profiles_before from public.profiles p;
 select md5(coalesce(jsonb_agg(to_jsonb(m) order by id),'[]'::jsonb)::text) into monitoring_before from public.parent_monitoring_observations m;
 insert into private.jejak_score_corrections as existing(user_id,corrected_score,before_progress,reason,corrected_at)
  select t.user_id,0,to_jsonb(t),'Owner requested reset of legacy Jejak only; v2 runs excluded; local operator backup retained.',clock_timestamp()
  from legacy_jejak_reset_targets t
 on conflict(user_id) do update set corrected_score=0,corrected_at=excluded.corrected_at,
  reason=existing.reason || E'\nPrior correction ' || existing.corrected_score || ' at ' || existing.corrected_at || '; ' || excluded.reason;
 alter table public.player_progress disable trigger player_progress_guard_monotonic;
 alter table public.player_progress disable trigger player_progress_guard_aspects;
 update public.player_progress p set jejak_pandawa_best_score=0,jejak_aspect_scores=null,
  revision=t.revision+1,updated_at=clock_timestamp()
 from legacy_jejak_reset_targets t where p.user_id=t.user_id;
 alter table public.player_progress enable trigger player_progress_guard_aspects;
 alter table public.player_progress enable trigger player_progress_guard_monotonic;
 if exists(select 1 from legacy_jejak_reset_targets t join public.player_progress p using(user_id)
  where p.jejak_pandawa_best_score<>0 or p.jejak_aspect_scores is not null or p.revision<>t.revision+1
  or (to_jsonb(p)-array['jejak_pandawa_best_score','jejak_aspect_scores','revision','updated_at'])
    is distinct from (to_jsonb(t)-array['jejak_pandawa_best_score','jejak_aspect_scores','revision','updated_at']))
 or untouched_before is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(p) order by user_id),'[]'::jsonb)::text)
   from public.player_progress p where not exists(select 1 from legacy_jejak_reset_targets t where t.user_id=p.user_id))
 or '__RUNS_HASH__' is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(r) order by id),'[]'::jsonb)::text) from public.jejak_aspect_runs r)
 or levels_before is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(l) order by user_id,level),'[]'::jsonb)::text) from public.level_progress l)
 or profiles_before is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(p) order by id),'[]'::jsonb)::text) from public.profiles p)
 or monitoring_before is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(m) order by id),'[]'::jsonb)::text) from public.parent_monitoring_observations m) then
  raise exception 'Unexpected modification; reset rolled back';
 end if;
end $$;
commit;
