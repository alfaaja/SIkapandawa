begin;
create table public.jejak_simulated_results (
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_key text not null check(length(source_key) between 1 and 100),
  source_label text not null check(length(source_label) between 1 and 200),
  provenance text not null default 'simulated' check(provenance = 'simulated'),
  source_total smallint not null check(source_total between 0 and 10),
  answers jsonb not null,
  aspect_scores jsonb not null check(aspect_scores = private.score_jejak_v2_answers(answers)),
  created_at timestamptz not null default now(),
  primary key(source_key,user_id),
  check(source_total = (aspect_scores->>'kejujuran')::integer + (aspect_scores->>'keberanian')::integer
    + (aspect_scores->>'kesopanan')::integer + (aspect_scores->>'kebijaksanaan')::integer + (aspect_scores->>'keadilan')::integer)
);
create index jejak_simulated_results_user on public.jejak_simulated_results(user_id);
comment on table public.jejak_simulated_results is
  'SIMULATION ONLY: synthetic answer allocations constrained to owner-supplied historical totals. Never student observations or actual v2 runs.';
alter table public.jejak_simulated_results enable row level security;
revoke all on public.jejak_simulated_results from public,anon,authenticated,service_role;
grant select on public.jejak_simulated_results to authenticated,service_role;
create policy jejak_simulation_admin_read on public.jejak_simulated_results for select to authenticated using((select private.is_admin()));

create function public.admin_jejak_simulation(school_name text default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if not (select private.is_admin()) then raise exception using errcode='42501',message='Admin access required'; end if;
  with cohort as (
    select r.*,p.school_name,p.username,p.display_name from public.jejak_simulated_results r
    join public.profiles p on p.id=r.user_id where not private.admin_profile_is_admin(p.id)
    and (admin_jejak_simulation.school_name is null or p.school_name=private.normalize_school_name(admin_jejak_simulation.school_name))
  ), scores as (
    select c.source_key,c.school_name,a.id,a.first_level,count(*)::integer students,
      avg((c.aspect_scores->>a.id)::integer) jejak,
      avg(coalesce((select sum(l.stars) from public.level_progress l where l.user_id=c.user_id
        and l.level between a.first_level and a.last_level),0)) mission
    from cohort c cross join private.character_aspects() a group by c.source_key,c.school_name,a.id,a.first_level
  ), reports as (
    select s.source_key,s.school_name,jsonb_build_object('sourceKey',s.source_key,
      'sourceLabel',(select min(c.source_label) from cohort c where c.source_key=s.source_key and c.school_name=s.school_name),
      'provenance','simulated','schoolName',s.school_name,'studentCount',max(s.students),'jejakKnownCount',max(s.students),'jejakVersion',2,
      'aspects',jsonb_agg(jsonb_build_object('id',s.id,'missionAverage',s.mission,'jejakAverage',s.jejak) order by s.first_level),
      'students',(select jsonb_agg(jsonb_build_object('username',c.username,'displayName',c.display_name,
        'total',c.source_total,'scores',c.aspect_scores) order by lower(c.username),c.user_id)
        from cohort c where c.source_key=s.source_key and c.school_name=s.school_name)) data
    from scores s group by s.source_key,s.school_name
  ) select coalesce(jsonb_agg(r.data order by r.school_name,r.source_key),'[]'::jsonb) into result from reports r;
  return result;
end $$;
revoke all on function public.admin_jejak_simulation(text) from public,anon;
grant execute on function public.admin_jejak_simulation(text) to authenticated;
notify pgrst,'reload schema';
commit;
