begin;
-- Existing rows remain parent observations; each new submission remains append-only.
alter table public.parent_monitoring_observations add column reporter_type text not null default 'parent'
  check (reporter_type in ('parent','teacher'));
alter table public.parent_monitoring_observations add column submitted_by uuid references auth.users(id) on delete set null;
create function private.normalize_monitoring_period(value text) returns text language sql immutable security invoker set search_path='' as $$
  select lower(regexp_replace(btrim(normalize(value,NFKC)),'[[:space:]]+',' ','g'))
$$;
alter table public.parent_monitoring_observations add column monitoring_period text not null default 'legacy'
  check(char_length(monitoring_period) between 2 and 80 and monitoring_period !~ '[[:cntrl:]]'
    and monitoring_period=private.normalize_monitoring_period(monitoring_period));
create index monitoring_source_user_point_period on public.parent_monitoring_observations(user_id,reporter_type,point_number,observed_at);
drop policy monitoring_read on public.parent_monitoring_observations;
create policy monitoring_read on public.parent_monitoring_observations for select to authenticated using (
  ((select auth.uid())=user_id and reporter_type='parent' and not (select private.is_staff()))
  or private.can_access_student(user_id));
-- All browser writes go through invoker RPCs + grants + source-aware RLS.
drop policy monitoring_insert on public.parent_monitoring_observations;
create policy monitoring_insert on public.parent_monitoring_observations for insert to authenticated with check (
  (reporter_type='parent' and (select auth.uid())=user_id and not (select private.is_staff()) and submitted_by is null)
  or (reporter_type='teacher' and (select private.is_teacher()) and submitted_by=(select auth.uid()) and private.can_access_student(user_id)));
grant insert(reporter_type,submitted_by,monitoring_period) on public.parent_monitoring_observations to authenticated;

create function public.submit_parent_monitoring_v2(submission_id uuid,point_number integer,observed_at timestamptz,
  guardian_name text,student_class text,situation text,behavior text,reinforcement text,scores jsonb,monitoring_period text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved public.parent_monitoring_observations; period text:=private.normalize_monitoring_period(monitoring_period);
begin
  perform public.parent_monitoring_context();
  if submission_id is null or period is null or period='legacy' or char_length(period) not between 2 and 80 then raise exception using errcode='22023',message='Submission and monitoring period required'; end if;
  insert into public.parent_monitoring_observations(id,user_id,point_number,observed_at,guardian_name,student_class,situation,behavior,reinforcement,scores,monitoring_period)
  values(submission_id,(select auth.uid()),point_number,observed_at,btrim(guardian_name),btrim(student_class),btrim(situation),btrim(behavior),btrim(reinforcement),scores,period)
  on conflict(id) do nothing;
  select * into saved from public.parent_monitoring_observations o where o.id=submission_id and o.user_id=(select auth.uid()) and o.reporter_type='parent';
  if saved.id is null or saved.point_number is distinct from point_number or saved.observed_at is distinct from observed_at
    or saved.guardian_name is distinct from btrim(guardian_name) or saved.student_class is distinct from btrim(student_class)
    or saved.situation is distinct from btrim(situation) or saved.behavior is distinct from btrim(behavior)
    or saved.reinforcement is distinct from btrim(reinforcement) or saved.scores is distinct from scores or saved.monitoring_period is distinct from period then
    raise exception using errcode='22023',message='Submission ID already used for different data'; end if;
  return jsonb_build_object('id',saved.id,'createdAt',saved.created_at);
end $$;

create or replace function public.parent_monitoring_context()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or (select private.is_staff()) then raise exception using errcode='42501',message='Use a student account'; end if;
  select jsonb_build_object('userId',p.id,'displayName',p.display_name,'username',p.username,'schoolName',p.school_name,
    'completedPoints',coalesce((select jsonb_agg(point_number order by point_number) from
      (select distinct point_number from public.parent_monitoring_observations where user_id=p.id and reporter_type='parent') q),'[]'::jsonb))
    into result from public.profiles p where p.id=(select auth.uid());
  if result is null then raise exception using errcode='42501',message='Student profile required'; end if;
  return result;
end $$;

create or replace function public.teacher_monitoring_context()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if not (select private.is_teacher()) then raise exception using errcode='42501',message='Teacher access required'; end if;
  select jsonb_build_object('students',coalesce(jsonb_agg(jsonb_build_object('userId',p.id,'displayName',p.display_name,
    'username',p.username,'schoolName',p.school_name,'completedPoints',coalesce((select jsonb_agg(point_number order by point_number)
      from (select distinct point_number from public.parent_monitoring_observations where user_id=p.id and reporter_type='teacher') q),'[]'::jsonb))
    order by p.display_name,p.id),'[]'::jsonb)) into result
  from public.profiles p where private.can_access_student(p.id);
  return result;
end $$;

create or replace function public.submit_teacher_monitoring(target_user_id uuid,submission_id uuid,point_number integer,observed_at timestamptz,
  guardian_name text,student_class text,situation text,behavior text,reinforcement text,scores jsonb,monitoring_period text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved public.parent_monitoring_observations; period text:=private.normalize_monitoring_period(monitoring_period);
begin
  if not (select private.is_teacher()) or not private.can_access_student(target_user_id) then raise exception using errcode='42501',message='Teacher school access required'; end if;
  if submission_id is null or period is null or period='legacy' or char_length(period) not between 2 and 80 then raise exception using errcode='22023',message='Submission and monitoring period required'; end if;
  insert into public.parent_monitoring_observations(id,user_id,point_number,observed_at,guardian_name,student_class,situation,behavior,reinforcement,scores,reporter_type,submitted_by,monitoring_period)
  values(submission_id,target_user_id,point_number,observed_at,btrim(guardian_name),btrim(student_class),btrim(situation),btrim(behavior),btrim(reinforcement),scores,'teacher',(select auth.uid()),period)
  on conflict(id) do nothing;
  select * into saved from public.parent_monitoring_observations o where o.id=submission_id and o.user_id=target_user_id
    and o.reporter_type='teacher' and o.submitted_by=(select auth.uid());
  if saved.id is null or saved.point_number is distinct from point_number or saved.observed_at is distinct from observed_at
    or saved.guardian_name is distinct from btrim(guardian_name) or saved.student_class is distinct from btrim(student_class)
    or saved.situation is distinct from btrim(situation) or saved.behavior is distinct from btrim(behavior)
    or saved.reinforcement is distinct from btrim(reinforcement) or saved.scores is distinct from scores or saved.monitoring_period is distinct from period then
    raise exception using errcode='22023',message='Submission ID already used for different data'; end if;
  return jsonb_build_object('id',saved.id,'createdAt',saved.created_at);
end $$;

create or replace function public.monitoring_history_v2(reporter_type text,target_user_id uuid default null,page_size integer default 25,page_offset integer default 0,monitoring_period text default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare target uuid:=coalesce(target_user_id,(select auth.uid())); result jsonb;
begin
  if reporter_type is null or reporter_type not in ('parent','teacher') then raise exception using errcode='22023',message='Invalid reporter'; end if;
  if (select auth.uid()) is null or not (
    (target=(select auth.uid()) and reporter_type='parent' and not (select private.is_staff()))
    or private.can_access_student(target)) then raise exception using errcode='42501',message='Monitoring access denied'; end if;
  if page_size not between 1 and 50 or page_size is null or page_offset is null or page_offset<0 then raise exception using errcode='22023',message='Invalid pagination'; end if;
  select jsonb_build_object('total',(select count(*) from public.parent_monitoring_observations o where o.user_id=target and o.reporter_type=monitoring_history_v2.reporter_type
      and (monitoring_history_v2.monitoring_period is null or o.monitoring_period=private.normalize_monitoring_period(monitoring_history_v2.monitoring_period))),
    'pageSize',page_size,'pageOffset',page_offset,'items',coalesce(jsonb_agg(jsonb_build_object(
      'id',o.id,'reporterType',o.reporter_type,'monitoringPeriod',o.monitoring_period,'pointNumber',o.point_number,'observedAt',o.observed_at,'guardianName',o.guardian_name,
      'studentClass',o.student_class,'situation',o.situation,'behavior',o.behavior,'reinforcement',o.reinforcement,'scores',o.scores,'createdAt',o.created_at)
      order by o.created_at desc,o.id desc),'[]'::jsonb)) into result
    from (select * from public.parent_monitoring_observations o where o.user_id=target and o.reporter_type=monitoring_history_v2.reporter_type
      and (monitoring_history_v2.monitoring_period is null or o.monitoring_period=private.normalize_monitoring_period(monitoring_history_v2.monitoring_period))
      order by o.created_at desc,o.id desc limit page_size offset page_offset) o;
  return result;
end $$;
-- Preserve existing clients, now explicitly restricted to parent observations.
create or replace function public.monitoring_history(target_user_id uuid default null,page_size integer default 25,page_offset integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
  select public.monitoring_history_v2('parent',target_user_id,page_size,page_offset)
$$;

create or replace function public.admin_monitoring_summary_v2(reporter_type text,school_name text default null,target_user_id uuid default null,monitoring_period text default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if not (select private.is_admin()) then raise exception using errcode='42501',message='Admin access required'; end if;
  if reporter_type is null or reporter_type not in ('parent','teacher') then raise exception using errcode='22023',message='Invalid reporter'; end if;
  if target_user_id is not null and not private.can_access_student(target_user_id) then raise exception using errcode='42501',message='Student access denied'; end if;
  with students as (
    select p.id,p.school_name from public.profiles p where private.can_access_student(p.id)
      and (admin_monitoring_summary_v2.school_name is null or p.school_name=private.normalize_school_name(admin_monitoring_summary_v2.school_name))
      and (target_user_id is null or p.id=target_user_id)
  ), schools as (select s.school_name,count(*)::integer as students from students s group by s.school_name),
  per_student as (
    select s.id,s.school_name,o.point_number,a.id as aspect,avg((o.scores->>a.id)::numeric) as score
    from students s join public.parent_monitoring_observations o on o.user_id=s.id and o.reporter_type=admin_monitoring_summary_v2.reporter_type
      and (admin_monitoring_summary_v2.monitoring_period is null or o.monitoring_period=private.normalize_monitoring_period(admin_monitoring_summary_v2.monitoring_period))
    cross join private.character_aspects() a group by s.id,s.school_name,o.point_number,a.id
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
      'participantCount',(select count(distinct o.user_id) from public.parent_monitoring_observations o join students u on u.id=o.user_id
        where u.school_name=s.school_name and o.reporter_type=admin_monitoring_summary_v2.reporter_type
          and (admin_monitoring_summary_v2.monitoring_period is null or o.monitoring_period=private.normalize_monitoring_period(admin_monitoring_summary_v2.monitoring_period))),
      'points',jsonb_agg(p.data order by p.n)) as data
    from schools s join points p on p.school_name=s.school_name group by s.school_name,s.students
  ) select coalesce(jsonb_agg(r.data order by r.school_name),'[]'::jsonb) into result from reports r;
  return result;
end $$;
create or replace function public.admin_monitoring_summary(school_name text default null,target_user_id uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
  select public.admin_monitoring_summary_v2('parent',school_name,target_user_id)
$$;

create or replace function public.admin_monitoring_comparison(target_user_id uuid,monitoring_period text default 'Periode 1')
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; selected_period text:=private.normalize_monitoring_period(monitoring_period);
begin
  if not (select private.is_admin()) or not private.can_access_student(target_user_id) then raise exception using errcode='42501',message='Student access denied'; end if;
  if selected_period is null or char_length(selected_period) not between 2 and 80 then raise exception using errcode='22023',message='Explicit monitoring period required'; end if;
  -- Same point AND explicit monitoring period; dates may differ. Legacy rows are not inferred.
  -- Repeated submissions remain stored: average within reporter/period/point/aspect first.
  with per_source as (
    select o.point_number,o.monitoring_period as period,a.id as aspect,o.reporter_type,
      avg((o.scores->>a.id)::numeric) as average,count(o.scores->>a.id)::integer as n
    from public.parent_monitoring_observations o cross join private.character_aspects() a
    where o.user_id=target_user_id and o.monitoring_period=selected_period group by o.point_number,o.monitoring_period,a.id,o.reporter_type
  ), pairs as (
    select p.point_number,p.period,p.aspect,p.average as parent_average,t.average as teacher_average,p.n as parent_count,t.n as teacher_count
    from per_source p join per_source t on p.point_number=t.point_number and p.period=t.period and p.aspect=t.aspect
    where p.reporter_type='parent' and t.reporter_type='teacher' and p.average is not null and t.average is not null
  ) select jsonb_build_object('ruleVersion','draft-1','periodPolicy','same-point-monitoring-period','cells',coalesce(jsonb_agg(jsonb_build_object(
    'pointNumber',point_number,'period',period,'aspect',aspect,'parentAverage',parent_average,'teacherAverage',teacher_average,
    'parentCount',parent_count,'teacherCount',teacher_count) order by point_number,period,aspect),'[]'::jsonb)) into result from pairs;
  return result;
end $$;
revoke all on function private.normalize_monitoring_period(text),public.submit_parent_monitoring_v2(uuid,integer,timestamptz,text,text,text,text,text,jsonb,text),
  public.teacher_monitoring_context(),public.submit_teacher_monitoring(uuid,uuid,integer,timestamptz,text,text,text,text,text,jsonb,text),
  public.monitoring_history_v2(text,uuid,integer,integer,text),public.admin_monitoring_summary_v2(text,text,uuid,text),public.admin_monitoring_comparison(uuid,text) from public,anon;
grant execute on function private.normalize_monitoring_period(text) to authenticated,service_role;
grant execute on function public.submit_parent_monitoring_v2(uuid,integer,timestamptz,text,text,text,text,text,jsonb,text),
  public.teacher_monitoring_context(),public.submit_teacher_monitoring(uuid,uuid,integer,timestamptz,text,text,text,text,text,jsonb,text),
  public.monitoring_history_v2(text,uuid,integer,integer,text),public.admin_monitoring_summary_v2(text,text,uuid,text),public.admin_monitoring_comparison(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;

