begin;
-- Master manages school/forum/teacher and its own profile/credentials; master deletion is forbidden.
create or replace function public.admin_authorize_account_action(actor_user_id uuid,action text,target_user_id uuid default null,target_school_name text default null)
 returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare actor private.admin_users; school text; target_school text;
begin
 select * into actor from private.admin_users where user_id=actor_user_id;
 if not found or actor.role not in ('master','school','forum') then raise exception using errcode='42501',message='Admin access required'; end if;
 if action in ('staff_update','staff_rename_username','staff_reset_password','staff_delete') then
  if actor.role<>'master' or not exists(
   select 1 from private.admin_users where user_id=target_user_id
    and (role in ('school','teacher','forum') or (role='master' and user_id=actor_user_id and action<>'staff_delete'))) then
   raise exception using errcode='42501',message='Staff target denied';
  end if;
  return jsonb_build_object('role',actor.role,'schoolName',null);
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

create or replace function public.admin_begin_account_operation(operation_id uuid,actor_user_id uuid,action text,target_user_id uuid,
 target_username text,request_fingerprint text,request_details jsonb) returns jsonb
 language plpgsql security invoker set search_path='' as $$
begin
 perform public.admin_authorize_account_action(actor_user_id,action,target_user_id,request_details->>'schoolName');
 if action in ('staff_update','staff_rename_username','staff_reset_password','staff_delete') then
  -- Serialize claims across actors/tabs; the pending ledger holds ownership until
  -- Auth mutation, profile CAS and any compensating rollback have finished.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('staff-account-operation:' || target_user_id::text,0));
  if exists(select 1 from public.admin_account_operations o where o.target_user_id=admin_begin_account_operation.target_user_id
   and o.status='pending' and o.operation_id<>admin_begin_account_operation.operation_id) then
   raise exception using errcode='22023',message='Idempotency target operation pending';
  end if;
 end if;
 if action='create_staff' and not private.can_provision_staff(actor_user_id,request_details->>'role',request_details->>'schoolName') then raise exception using errcode='42501',message='Staff role or school denied'; end if;
 return private.admin_begin_account_operation(operation_id,actor_user_id,
  case when action='create_staff' then 'create' when action like 'staff\_%' escape '\' then substr(action,7) else action end,target_user_id,target_username,request_fingerprint,request_details);
end $$;

create or replace function public.admin_service_update_staff_identity(
  actor_user_id uuid,
  target_user_id uuid,
  expected_username text,
  new_display_name text,
  new_username text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_profile public.profiles%rowtype;
  normalized_expected_username text := lower(btrim(coalesce(expected_username, '')));
  normalized_new_username text := lower(btrim(coalesce(new_username, '')));
  trimmed_display_name text := btrim(coalesce(new_display_name, ''));
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service access required';
  end if;
  if target_user_id is null then
    raise exception using errcode = '22023', message = 'Invalid target';
  end if;
  if normalized_expected_username !~ '^[a-z0-9._-]{3,20}$' then
    raise exception using errcode = '22023', message = 'Invalid expected username';
  end if;
  if btrim(coalesce(new_username, '')) <> normalized_new_username
     or normalized_new_username !~ '^[a-z0-9._-]{3,20}$' then
    raise exception using errcode = '22023', message = 'Invalid username';
  end if;
  if char_length(trimmed_display_name) not between 2 and 24 then
    raise exception using errcode = '22023', message = 'Invalid display name';
  end if;
  perform public.admin_authorize_account_action(actor_user_id,'staff_rename_username',target_user_id);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('admin-profile-identity:' || target_user_id::text, 0)
  );

  select * into current_profile
  from public.profiles
  where id = target_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Player not found';
  end if;
  if current_profile.normalized_username <> normalized_expected_username then
    raise exception using errcode = '40001', message = 'Profile changed; refresh and retry';
  end if;

  perform pg_catalog.set_config('app.admin_identity_rename', 'on', true);
  update public.profiles
  set display_name = trimmed_display_name,
      username = normalized_new_username,
      normalized_username = normalized_new_username
  where id = target_user_id
  returning * into current_profile;

  return jsonb_build_object(
    'userId', current_profile.id,
    'displayName', current_profile.display_name,
    'username', current_profile.username,
    'updatedAt', current_profile.updated_at
  );
end
$$;


revoke all on function public.admin_service_update_staff_identity(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_service_update_staff_identity(uuid,uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
