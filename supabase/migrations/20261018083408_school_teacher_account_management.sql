begin;
-- School administrators manage only teachers belonging to their verified school.
create or replace function public.admin_authorize_account_action(actor_user_id uuid,action text,target_user_id uuid default null,target_school_name text default null)
 returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare actor private.admin_users; school text; target_school text;
begin
 select * into actor from private.admin_users where user_id=actor_user_id;
 if not found or actor.role not in ('master','school','forum') then raise exception using errcode='42501',message='Admin access required'; end if;
 if action in ('staff_update','staff_rename_username','staff_reset_password','staff_delete') then
  if not exists(select 1 from private.admin_users target where target.user_id=target_user_id and (
   (actor.role='master' and (target.role in ('school','teacher','forum') or (target.role='master' and target.user_id=actor_user_id and action<>'staff_delete')))
   or (actor.role='school' and target.role='teacher' and target.school_name=actor.school_name)
  )) then raise exception using errcode='42501',message='Staff target denied'; end if;
  return jsonb_build_object('role',actor.role,'schoolName',actor.school_name);
 end if;
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
revoke all on function public.admin_authorize_account_action(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_authorize_account_action(uuid,text,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
