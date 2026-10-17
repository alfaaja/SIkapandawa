begin;
create or replace function private.valid_monitoring_scores(scores jsonb)
returns boolean language sql immutable security invoker set search_path = '' as $$
  select case when jsonb_typeof(scores) is distinct from 'object' then false else
    (select count(*)=5 and bool_and(key in ('kejujuran','keberanian','kesopanan','kebijaksanaan','keadilan')
      and value in ('null'::jsonb,'1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb)) from jsonb_each(scores)) end
$$;

create table public.parent_monitoring_observations (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  point_number smallint not null check (point_number between 1 and 12),
  observed_at timestamptz not null check (isfinite(observed_at)),
  guardian_name text not null check (char_length(btrim(guardian_name)) between 2 and 100),
  student_class text not null default '' check (char_length(student_class)<=50),
  situation text not null check (char_length(btrim(situation)) between 1 and 1500),
  behavior text not null default '' check (char_length(behavior)<=2000),
  reinforcement text not null default '' check (char_length(reinforcement)<=2000),
  scores jsonb not null check (private.valid_monitoring_scores(scores)),
  created_at timestamptz not null default now()
);
comment on table public.parent_monitoring_observations is 'Append-only parent observations: 12 flexible points, five aspects scored 1..4 or NULL for N/A. Repeated deliberate submissions are separate rows.';
create index parent_monitoring_user_created on public.parent_monitoring_observations(user_id,created_at desc,id desc);
create index parent_monitoring_user_point on public.parent_monitoring_observations(user_id,point_number);
alter table public.parent_monitoring_observations enable row level security;
create policy monitoring_read on public.parent_monitoring_observations for select to authenticated
  using ((select auth.uid())=user_id or (select private.is_admin()));
create policy monitoring_insert on public.parent_monitoring_observations for insert to authenticated
  with check ((select auth.uid())=user_id and not (select private.is_admin()));
revoke all on public.parent_monitoring_observations from public,anon,authenticated;
grant select on public.parent_monitoring_observations to authenticated;
grant insert (id,user_id,point_number,observed_at,guardian_name,student_class,situation,behavior,reinforcement,scores)
  on public.parent_monitoring_observations to authenticated;
grant all on public.parent_monitoring_observations to service_role;

create or replace function public.parent_monitoring_context()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or (select private.is_admin()) then
    raise exception using errcode='42501',message='Use a student account';
  end if;
  select jsonb_build_object('userId',p.id,'displayName',p.display_name,'username',p.username,'schoolName',p.school_name,
    'completedPoints',coalesce((select jsonb_agg(point_number order by point_number) from
      (select distinct point_number from public.parent_monitoring_observations where user_id=p.id) as points),'[]'::jsonb))
    into result from public.profiles p where p.id=(select auth.uid());
  if result is null then raise exception using errcode='42501',message='Student profile required'; end if;
  return result;
end $$;

create or replace function public.submit_parent_monitoring(submission_id uuid,point_number integer,observed_at timestamptz,
  guardian_name text,student_class text,situation text,behavior text,reinforcement text,scores jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved public.parent_monitoring_observations;
begin
  perform public.parent_monitoring_context();
  if submission_id is null then raise exception using errcode='22023',message='Submission ID required'; end if;
  insert into public.parent_monitoring_observations(id,user_id,point_number,observed_at,guardian_name,student_class,situation,behavior,reinforcement,scores)
  values(submission_id,(select auth.uid()),point_number,observed_at,btrim(guardian_name),btrim(student_class),btrim(situation),btrim(behavior),btrim(reinforcement),scores)
  on conflict (id) do nothing;
  select * into saved from public.parent_monitoring_observations o where o.id=submission_id and o.user_id=(select auth.uid());
  if saved.id is null or saved.point_number is distinct from point_number or saved.observed_at is distinct from observed_at
    or saved.guardian_name is distinct from btrim(guardian_name) or saved.student_class is distinct from btrim(student_class)
    or saved.situation is distinct from btrim(situation) or saved.behavior is distinct from btrim(behavior)
    or saved.reinforcement is distinct from btrim(reinforcement) or saved.scores is distinct from scores then
    raise exception using errcode='22023',message='Submission ID already used for different data';
  end if;
  return jsonb_build_object('id',saved.id,'createdAt',saved.created_at);
end $$;

create or replace function public.monitoring_history(target_user_id uuid default null,page_size integer default 25,page_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare target uuid:=coalesce(target_user_id,(select auth.uid())); result jsonb;
begin
  if (select auth.uid()) is null or (target is distinct from (select auth.uid()) and not (select private.is_admin())) then
    raise exception using errcode='42501',message='Monitoring access denied';
  end if;
  if page_size not between 1 and 50 or page_size is null or page_offset is null or page_offset<0 then
    raise exception using errcode='22023',message='Invalid pagination';
  end if;
  select jsonb_build_object('total',(select count(*) from public.parent_monitoring_observations where user_id=target),
    'pageSize',page_size,'pageOffset',page_offset,'items',coalesce(jsonb_agg(jsonb_build_object(
      'id',o.id,'pointNumber',o.point_number,'observedAt',o.observed_at,'guardianName',o.guardian_name,'studentClass',o.student_class,
      'situation',o.situation,'behavior',o.behavior,'reinforcement',o.reinforcement,'scores',o.scores,'createdAt',o.created_at)
      order by o.created_at desc,o.id desc),'[]'::jsonb)) into result
    from (select * from public.parent_monitoring_observations where user_id=target
      order by created_at desc,id desc limit page_size offset page_offset) o;
  return result;
end $$;

create or replace function public.admin_monitoring_summary(school_name text default null,target_user_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if not (select private.is_admin()) then raise exception using errcode='42501',message='Admin access required'; end if;
  with students as (
    select p.id,p.school_name from public.profiles p where not private.admin_profile_is_admin(p.id)
      and (admin_monitoring_summary.school_name is null or p.school_name=private.normalize_school_name(admin_monitoring_summary.school_name))
      and (target_user_id is null or p.id=target_user_id)
  ), schools as (select s.school_name,count(*)::integer as students from students s group by s.school_name),
  per_student as (
    select s.id,s.school_name,o.point_number,a.id as aspect,avg((o.scores->>a.id)::numeric) as score
    from students s join public.parent_monitoring_observations o on o.user_id=s.id cross join private.character_aspects() a
    group by s.id,s.school_name,o.point_number,a.id
  ), per_aspect as (
    select s.school_name,point.n,a.id as aspect,a.first_level,avg(v.score) as average,count(v.score)::integer as count
    from schools s cross join generate_series(1,12) point(n) cross join private.character_aspects() a
    left join per_student v on v.school_name=s.school_name and v.point_number=point.n and v.aspect=a.id
    group by s.school_name,point.n,a.id,a.first_level
  ), points as (
    select a.school_name,a.n,jsonb_build_object('pointNumber',a.n,'aspects',jsonb_agg(
      jsonb_build_object('id',a.aspect,'average',a.average,'studentCount',a.count) order by a.first_level)) as data
    from per_aspect a group by a.school_name,a.n
  ), reports as (
    select s.school_name,jsonb_build_object('schoolName',s.school_name,'studentCount',s.students,
      'participantCount',(select count(distinct o.user_id) from public.parent_monitoring_observations o join students u on u.id=o.user_id where u.school_name=s.school_name),
      'points',jsonb_agg(p.data order by p.n)) as data
    from schools s join points p on p.school_name=s.school_name group by s.school_name,s.students
  ) select coalesce(jsonb_agg(r.data order by r.school_name),'[]'::jsonb) into result from reports r;
  return result;
end $$;

revoke all on function private.valid_monitoring_scores(jsonb) from public,anon;
grant execute on function private.valid_monitoring_scores(jsonb) to authenticated,service_role;
revoke all on function public.parent_monitoring_context(),public.submit_parent_monitoring(uuid,integer,timestamptz,text,text,text,text,text,jsonb),
  public.monitoring_history(uuid,integer,integer),public.admin_monitoring_summary(text,uuid) from public,anon;
grant execute on function public.parent_monitoring_context(),public.submit_parent_monitoring(uuid,integer,timestamptz,text,text,text,text,text,jsonb),
  public.monitoring_history(uuid,integer,integer),public.admin_monitoring_summary(text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
