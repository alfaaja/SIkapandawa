begin;

-- Versioned answer key: existing v1 RPC/key remain untouched for older clients.
create function private.jejak_v2_cards()
returns table(card_id text,aspect text,good boolean)
language sql immutable security invoker set search_path='' as $$
 values ('yudhistira-01','kejujuran',true),('yudhistira-02','kejujuran',false),('yudhistira-04','kejujuran',true),
 ('bima-01','keberanian',false),('bima-02','keberanian',true),('bima-03','keberanian',false),
 ('arjuna-01','kesopanan',false),('arjuna-02','kesopanan',true),('arjuna-03','kesopanan',true),
 ('nakula-01','kebijaksanaan',true),('nakula-02','kebijaksanaan',false),('nakula-03','kebijaksanaan',false),
 ('sadewa-04','keadilan',false),('sadewa-05','keadilan',true),('sadewa-06','keadilan',true)
$$;

create function private.score_jejak_v2_answers(answers jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb;
begin
 if jsonb_typeof(answers) is distinct from 'array' then raise exception using errcode='22023',message='Expected ten answers'; end if;
 if jsonb_array_length(answers)<>10 or exists (
  select 1 from jsonb_array_elements(answers) a where jsonb_typeof(a) is distinct from 'object'
 ) then raise exception using errcode='22023',message='Expected ten answer objects'; end if;
 if exists (select 1 from jsonb_array_elements(answers) a
  left join private.jejak_v2_cards() c on c.card_id=a->>'cardId'
  where c.card_id is null or coalesce(a->>'basket','') not in ('good','bad')
    or (select count(*) from jsonb_object_keys(a))<>2
 ) or (select count(distinct a->>'cardId') from jsonb_array_elements(answers) a)<>10
 or exists (select 1 from jsonb_array_elements(answers) a join private.jejak_v2_cards() c on c.card_id=a->>'cardId'
  group by c.aspect having count(*)<>2)
 then raise exception using errcode='22023',message='Invalid version 2 answers'; end if;
 select jsonb_object_agg(aspect,score) into result from (
  select c.aspect,count(*) filter(where (a->>'basket'='good')=c.good)::integer score
  from jsonb_array_elements(answers) a join private.jejak_v2_cards() c on c.card_id=a->>'cardId' group by c.aspect
 ) scores;
 return result;
end $$;

create table public.jejak_aspect_runs (
 id uuid primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 curriculum_version smallint not null default 2 check(curriculum_version=2),
 answers jsonb not null,
 aspect_scores jsonb not null check(aspect_scores=private.score_jejak_v2_answers(answers)),
 total_score smallint not null check(total_score between 0 and 10 and total_score=
   (aspect_scores->>'kejujuran')::integer+(aspect_scores->>'keberanian')::integer+(aspect_scores->>'kesopanan')::integer+
   (aspect_scores->>'kebijaksanaan')::integer+(aspect_scores->>'keadilan')::integer),
 created_at timestamptz not null default now()
);
comment on table public.jejak_aspect_runs is 'Append-only complete v2 runs. Server-derived scores; per-student aspect maxima are independent of legacy best totals.';
create index jejak_aspect_runs_user_version on public.jejak_aspect_runs(user_id,curriculum_version);
alter table public.jejak_aspect_runs enable row level security;
create policy jejak_runs_read on public.jejak_aspect_runs for select to authenticated
 using((select auth.uid())=user_id or (select private.is_admin()));
create policy jejak_runs_insert on public.jejak_aspect_runs for insert to authenticated
 with check((select auth.uid())=user_id and not (select private.is_admin()) and exists(
  select 1 from public.player_progress p where p.user_id=(select auth.uid()) and p.jejak_pandawa_unlocked));
revoke all on public.jejak_aspect_runs from public,anon,authenticated;
grant select on public.jejak_aspect_runs to authenticated;
grant insert(id,user_id,answers,aspect_scores,total_score) on public.jejak_aspect_runs to authenticated;
grant all on public.jejak_aspect_runs to service_role;

create function public.record_jejak_aspect_result_v2(submission_id uuid,run_answers jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare scores jsonb; total smallint; saved public.jejak_aspect_runs;
begin
 if (select auth.uid()) is null or (select private.is_admin()) then raise exception using errcode='42501',message='Student account required'; end if;
 if submission_id is null then raise exception using errcode='22023',message='Submission ID required'; end if;
 scores:=private.score_jejak_v2_answers(run_answers);
 select sum(value::integer)::smallint into total from jsonb_each_text(scores);
 -- Existing row lock/unlock validation and monotonic overall total are preserved.
 perform public.record_jejak_result(total);
 insert into public.jejak_aspect_runs(id,user_id,answers,aspect_scores,total_score)
 values(submission_id,(select auth.uid()),run_answers,scores,total) on conflict(id) do nothing;
 select * into saved from public.jejak_aspect_runs r where r.id=submission_id and r.user_id=(select auth.uid());
 if saved.id is null or saved.answers is distinct from run_answers then raise exception using errcode='22023',message='Submission ID already used'; end if;
 return jsonb_build_object('id',saved.id,'version',saved.curriculum_version,'scores',saved.aspect_scores,'total',saved.total_score);
end $$;

create function public.admin_school_aspect_averages_v2(school_name text default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not (select private.is_admin()) then raise exception using errcode='42501',message='Admin access required'; end if;
 with students as (
  select p.id,p.school_name from public.profiles p where not private.admin_profile_is_admin(p.id)
   and (admin_school_aspect_averages_v2.school_name is null or p.school_name=private.normalize_school_name(admin_school_aspect_averages_v2.school_name))
 ), best as (
  select r.user_id,a.id,max((r.aspect_scores->>a.id)::integer) score from public.jejak_aspect_runs r
   join students s on s.id=r.user_id cross join private.character_aspects() a
   where r.curriculum_version=2 group by r.user_id,a.id
 ), student_aspects as (
  select s.school_name,s.id,a.id aspect,a.first_level,b.score,
   coalesce((select sum(l.stars) from public.level_progress l where l.user_id=s.id and l.level between a.first_level and a.last_level),0) mission
  from students s cross join private.character_aspects() a left join best b on b.user_id=s.id and b.id=a.id
 ), averages as (
  select sa.school_name,sa.aspect,sa.first_level,count(*)::integer students,count(sa.score)::integer known,avg(sa.score) jejak,avg(sa.mission) mission
  from student_aspects sa group by sa.school_name,sa.aspect,sa.first_level
 ), reports as (
  select av.school_name,jsonb_build_object('schoolName',av.school_name,'studentCount',max(av.students),'jejakVersion',2,'jejakKnownCount',max(av.known),
   'aspects',jsonb_agg(jsonb_build_object('id',av.aspect,'missionAverage',av.mission,'jejakAverage',av.jejak) order by av.first_level)) data
  from averages av group by av.school_name
 ) select coalesce(jsonb_agg(r.data order by r.school_name),'[]'::jsonb) into result from reports r;
 return result;
end $$;

revoke all on function private.jejak_v2_cards(),private.score_jejak_v2_answers(jsonb) from public,anon;
grant execute on function private.jejak_v2_cards(),private.score_jejak_v2_answers(jsonb) to authenticated,service_role;
revoke all on function public.record_jejak_aspect_result_v2(uuid,jsonb),public.admin_school_aspect_averages_v2(text) from public,anon;
grant execute on function public.record_jejak_aspect_result_v2(uuid,jsonb),public.admin_school_aspect_averages_v2(text) to authenticated;
notify pgrst,'reload schema';
commit;
