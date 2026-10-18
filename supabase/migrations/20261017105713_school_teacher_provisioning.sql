begin;
-- School administrators may provision only teachers of their own school.
create function private.can_provision_staff(actor_id uuid,wanted_role text,wanted_school text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.admin_users a where a.user_id=actor_id
  and wanted_role in ('school','forum','teacher') and (
   (a.role='master' and (wanted_role='forum' or private.normalize_school_name(wanted_school) is not null))
   or (a.role='school' and wanted_role='teacher' and a.school_name=private.normalize_school_name(wanted_school))))
$$;
revoke all on function private.can_provision_staff(uuid,text,text) from public,anon,authenticated;
grant execute on function private.can_provision_staff(uuid,text,text) to service_role;
create or replace function public.admin_list_staff() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from private.admin_users where user_id=(select auth.uid()) and role in ('master','school')) then raise exception using errcode='42501',message='Master access required'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('userId',p.id,'displayName',p.display_name,'username',p.username,
  'role',a.role,'schoolName',a.school_name) order by a.role,p.username),'[]') into result
 from private.admin_users a join public.profiles p on p.id=a.user_id where (select private.is_master_admin()) or (a.role='teacher' and a.school_name=(select school_name from private.admin_users where user_id=(select auth.uid())));
 return result;
end $$;

create or replace function public.admin_authorize_account_action(actor_user_id uuid,action text,target_user_id uuid default null,target_school_name text default null)
 returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare actor private.admin_users; school text; target_school text;
begin
 select * into actor from private.admin_users where user_id=actor_user_id;
 if not found or actor.role not in ('master','school','forum') then raise exception using errcode='42501',message='Admin access required'; end if;
 if action not in ('create','update','rename_username','reset_password','delete','create_staff') then raise exception using errcode='22023',message='Invalid action'; end if;
 if action='create_staff' then
  if actor.role not in ('master','school') or (actor.role='school' and coalesce(private.normalize_school_name(target_school_name),actor.school_name)<>actor.school_name) then raise exception using errcode='42501',message='Staff school scope denied'; end if;
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

create or replace function public.admin_assign_staff(actor_user_id uuid,target_user_id uuid,staff_role text,staff_school_name text default null)
 returns void language plpgsql security definer set search_path='' as $$
declare school text;
begin
 if not private.can_provision_staff(actor_user_id,staff_role,staff_school_name) then
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

create or replace function public.admin_begin_account_operation(operation_id uuid,actor_user_id uuid,action text,target_user_id uuid,
 target_username text,request_fingerprint text,request_details jsonb) returns jsonb
 language plpgsql security invoker set search_path='' as $$
begin
 perform public.admin_authorize_account_action(actor_user_id,action,target_user_id,request_details->>'schoolName');
 if action='create_staff' and not private.can_provision_staff(actor_user_id,request_details->>'role',request_details->>'schoolName') then raise exception using errcode='42501',message='Staff role or school denied'; end if;
 return private.admin_begin_account_operation(operation_id,actor_user_id,
  case when action='create_staff' then 'create' else action end,target_user_id,target_username,request_fingerprint,request_details);
end $$;

create or replace function private.provision_new_staff(auth_row jsonb) returns void
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
  where a.user_id=actor and private.can_provision_staff(actor,wanted_role,school) and o.operation_id=op and o.status='pending' and o.action='create'
   and o.target_username=auth_row->'raw_user_meta_data'->>'normalized_username'
   and o.request_details->>'role'=wanted_role and (o.request_details->>'schoolName') is not distinct from school
 ) then raise exception using errcode='42501',message='Invalid staff provisioning claim'; end if;
 if wanted_role<>'forum' and school is distinct from (select school_name from public.profiles where id=(auth_row->>'id')::uuid) then
  raise exception using errcode='22023',message='Staff school mismatch'; end if;
 insert into private.admin_users(user_id,role,school_name) values((auth_row->>'id')::uuid,wanted_role,school);
end $$;
notify pgrst,'reload schema';
commit;
