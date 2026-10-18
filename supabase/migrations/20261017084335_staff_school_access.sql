begin;

alter table private.admin_users add column role text not null default 'forum'
 check(role in ('master','school','forum','teacher'));
alter table private.admin_users add column school_name text;
-- Only an already trusted membership can become the original master.
update private.admin_users a set role='master'
 from public.profiles p where p.id=a.user_id and p.normalized_username='sikapandawa';
alter table private.admin_users add constraint admin_scope_shape check(
 (role in ('master','forum') and school_name is null) or
 (role in ('school','teacher') and school_name is not null and char_length(school_name) between 2 and 100
  and school_name=private.normalize_school_name(school_name)));
create unique index one_admin_per_school on private.admin_users(school_name) where role='school';
create unique index one_master_admin on private.admin_users(role) where role='master';

create function private.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.admin_users where user_id=(select auth.uid()))
$$;
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.admin_users where user_id=(select auth.uid()) and role in ('master','school','forum'))
$$;
create function private.is_teacher() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.admin_users where user_id=(select auth.uid()) and role='teacher')
$$;
create function private.is_master_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.admin_users where user_id=(select auth.uid()) and role='master')
$$;
create function private.can_access_student(target_user_id uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.admin_users a join public.profiles p on p.id=target_user_id
  where a.user_id=(select auth.uid()) and not exists(select 1 from private.admin_users member where member.user_id=p.id)
  and (a.role in ('master','forum') or (a.role in ('school','teacher') and a.school_name=p.school_name)))
$$;
create or replace function private.admin_profile_is_admin(target_user_id uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select (select private.is_staff()) and exists(select 1 from private.admin_users where user_id=target_user_id)
$$;
create function public.staff_access() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 select jsonb_build_object('role',a.role,'schoolName',a.school_name,'userId',a.user_id,
  'username',p.username,'displayName',p.display_name) into result
 from private.admin_users a join public.profiles p on p.id=a.user_id where a.user_id=(select auth.uid());
 if result is null then raise exception using errcode='42501',message='Staff access required'; end if;
 return result;
end $$;
create function private.admin_scope() returns jsonb language sql stable security invoker set search_path='' as $$
 select public.staff_access()
$$;

-- Replace broad policies; permissive policies otherwise combine with OR.
alter policy profiles_select_own on public.profiles using((select auth.uid())=id and not (select private.is_staff()));
alter policy profiles_select_admin on public.profiles using(private.can_access_student(id));
alter policy player_progress_select_own on public.player_progress using((select auth.uid())=user_id and not (select private.is_staff()));
alter policy player_progress_select_admin on public.player_progress using(private.can_access_student(user_id));
alter policy level_progress_select_own on public.level_progress using((select auth.uid())=user_id and not (select private.is_staff()));
alter policy level_progress_select_admin on public.level_progress using(private.can_access_student(user_id));
alter policy player_progress_update_own on public.player_progress
 using((select auth.uid())=user_id and not (select private.is_staff())) with check((select auth.uid())=user_id and not (select private.is_staff()));
alter policy level_progress_update_own on public.level_progress
 using((select auth.uid())=user_id and not (select private.is_staff())) with check((select auth.uid())=user_id and not (select private.is_staff()));
alter policy jejak_runs_read on public.jejak_aspect_runs using(
 ((select auth.uid())=user_id and not (select private.is_staff())) or ((select private.is_admin()) and private.can_access_student(user_id)));
alter policy jejak_runs_insert on public.jejak_aspect_runs with check(
 (select auth.uid())=user_id and not (select private.is_staff()) and exists(
  select 1 from public.player_progress where user_id=(select auth.uid()) and jejak_pandawa_unlocked));
alter policy jejak_simulation_admin_read on public.jejak_simulated_results using(
 (select private.is_admin()) and private.can_access_student(user_id));
-- The following monitoring migration replaces these again to separate reporters.
alter policy monitoring_read on public.parent_monitoring_observations using(
 ((select auth.uid())=user_id and not (select private.is_staff())) or ((select private.is_admin()) and private.can_access_student(user_id)));
alter policy monitoring_insert on public.parent_monitoring_observations with check(
 (select auth.uid())=user_id and not (select private.is_staff()));

create function public.admin_list_staff() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not (select private.is_master_admin()) then raise exception using errcode='42501',message='Master access required'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('userId',p.id,'displayName',p.display_name,'username',p.username,
  'role',a.role,'schoolName',a.school_name) order by a.role,p.username),'[]') into result
 from private.admin_users a join public.profiles p on p.id=a.user_id;
 return result;
end $$;

-- Service-only authorization is also required because Auth Admin bypasses RLS.
create function public.admin_authorize_account_action(actor_user_id uuid,action text,target_user_id uuid default null,target_school_name text default null)
 returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare actor private.admin_users; school text; target_school text;
begin
 select * into actor from private.admin_users where user_id=actor_user_id;
 if not found or actor.role not in ('master','school','forum') then raise exception using errcode='42501',message='Admin access required'; end if;
 if action not in ('create','update','rename_username','reset_password','delete','create_staff') then raise exception using errcode='22023',message='Invalid action'; end if;
 if action='create_staff' then
  if actor.role<>'master' then raise exception using errcode='42501',message='Master access required'; end if;
 elsif action='create' then
  school:=private.normalize_school_name(target_school_name);
  if actor.role='school' then
   if school is not null and school<>actor.school_name then raise exception using errcode='42501',message='School scope denied'; end if;
   school:=actor.school_name;
  end if;
  school:=coalesce(school,'SDN Kalibanteng Kulon 01');
  if char_length(school) not between 2 and 100 then raise exception using errcode='22023',message='School required'; end if;
 else
  select school_name into target_school from public.profiles where id=target_user_id;
  if target_school is null or exists(select 1 from private.admin_users where user_id=target_user_id)
   or (actor.role='school' and target_school<>actor.school_name) then
   raise exception using errcode='42501',message='Student scope denied';
  end if;
 end if;
 return jsonb_build_object('role',actor.role,'schoolName',coalesce(school,actor.school_name));
end $$;

create function public.admin_assign_staff(actor_user_id uuid,target_user_id uuid,staff_role text,staff_school_name text default null)
 returns void language plpgsql security definer set search_path='' as $$
declare school text;
begin
 if not exists(select 1 from private.admin_users where user_id=actor_user_id and role='master') then
  raise exception using errcode='42501',message='Master access required'; end if;
 if staff_role not in ('school','forum','teacher') then raise exception using errcode='22023',message='Invalid staff role'; end if;
 school:=case when staff_role='forum' then null else private.normalize_school_name(staff_school_name) end;
 if staff_role<>'forum' and (school is null or char_length(school) not between 2 and 100) then raise exception using errcode='22023',message='School required'; end if;
 if not exists(select 1 from public.profiles where id=target_user_id and (school is null or school_name=school)) then
  raise exception using errcode='22023',message='Staff profile mismatch'; end if;
 if exists(select 1 from private.admin_users where user_id=target_user_id) then
  if not exists(select 1 from private.admin_users where user_id=target_user_id and role=staff_role and school_name is not distinct from school) then
   raise exception using errcode='42501',message='Staff membership mismatch'; end if;
  return;
 end if;
 insert into private.admin_users(user_id,role,school_name) values(target_user_id,staff_role,school);
end $$;

-- Keep existing audit/idempotency logic private behind a scope-checking wrapper.
alter function public.admin_begin_account_operation(uuid,uuid,text,uuid,text,text,jsonb) set schema private;
create function public.admin_begin_account_operation(operation_id uuid,actor_user_id uuid,action text,target_user_id uuid,
 target_username text,request_fingerprint text,request_details jsonb) returns jsonb
 language plpgsql security invoker set search_path='' as $$
begin
 perform public.admin_authorize_account_action(actor_user_id,action,target_user_id,request_details->>'schoolName');
 return private.admin_begin_account_operation(operation_id,actor_user_id,
  case when action='create_staff' then 'create' else action end,target_user_id,target_username,request_fingerprint,request_details);
end $$;

revoke all on function private.is_staff(),private.is_teacher(),private.is_master_admin(),private.can_access_student(uuid),private.admin_scope(),
 public.staff_access(),public.admin_list_staff() from public,anon,authenticated,service_role;
grant execute on function private.is_staff(),private.is_teacher(),private.is_master_admin(),private.can_access_student(uuid),private.admin_scope(),
 public.staff_access(),public.admin_list_staff() to authenticated;
revoke all on function public.admin_authorize_account_action(uuid,text,uuid,text),public.admin_assign_staff(uuid,uuid,text,text),
 public.admin_begin_account_operation(uuid,uuid,text,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_authorize_account_action(uuid,text,uuid,text),public.admin_assign_staff(uuid,uuid,text,text),
 public.admin_begin_account_operation(uuid,uuid,text,uuid,text,text,jsonb) to service_role;

-- Provisioning is atomic with Auth insertion: a staff profile never commits as a student.
-- app_metadata is writable only by trusted Auth Admin, unlike user_metadata.
create function private.provision_new_staff(auth_row jsonb) returns void
 language plpgsql security definer set search_path='' as $$
declare meta jsonb:=auth_row->'raw_app_meta_data'; actor uuid; op uuid; school text; wanted_role text;
begin
 wanted_role:=meta->>'staff_role';
 if wanted_role is null then
  if meta->>'admin_operation_id' is not null then
   op:=(meta->>'admin_operation_id')::uuid;
   select o.actor_user_id into actor from public.admin_account_operations o
    where o.operation_id=op and o.status='pending' and o.action='create' and o.request_details->>'role' is null
     and o.target_username=auth_row->'raw_user_meta_data'->>'normalized_username';
   if actor is null then raise exception using errcode='42501',message='Invalid student provisioning claim'; end if;
   -- Also protect old Edge versions whose audit details omit schoolName.
   perform public.admin_authorize_account_action(actor,'create',null,auth_row->'raw_user_meta_data'->>'school_name');
  end if;
  return;
 end if;
 actor:=(meta->>'staff_actor_id')::uuid; op:=(meta->>'admin_operation_id')::uuid;
 school:=case when wanted_role='forum' then null else private.normalize_school_name(meta->>'staff_school_name') end;
 if wanted_role not in ('school','forum','teacher') or not exists(
  select 1 from private.admin_users a join public.admin_account_operations o on o.actor_user_id=a.user_id
  where a.user_id=actor and a.role='master' and o.operation_id=op and o.status='pending' and o.action='create'
   and o.target_username=auth_row->'raw_user_meta_data'->>'normalized_username'
   and o.request_details->>'role'=wanted_role and (o.request_details->>'schoolName') is not distinct from school
 ) then raise exception using errcode='42501',message='Invalid staff provisioning claim'; end if;
 if wanted_role<>'forum' and school is distinct from (select school_name from public.profiles where id=(auth_row->>'id')::uuid) then
  raise exception using errcode='22023',message='Staff school mismatch'; end if;
 insert into private.admin_users(user_id,role,school_name) values((auth_row->>'id')::uuid,wanted_role,school);
end $$;
revoke all on function private.provision_new_staff(jsonb) from public,anon,authenticated,service_role;
do $patch$
declare definition text;
begin
 definition:=pg_get_functiondef('private.handle_new_user()'::regprocedure);
 if position('  return new;' in definition)=0 then raise exception 'Unexpected signup trigger definition'; end if;
 definition:=replace(definition,'  return new;','  perform private.provision_new_staff(to_jsonb(new));' || E'\n  return new;');
 execute definition;
end $patch$;
notify pgrst,'reload schema';
commit;
