-- Operator-only one-off reset. Supply bcrypt hashes in memory, never plaintext.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '20s';
do $$
declare replacements jsonb := __REPLACEMENTS_JSON__;
  expected integer := __EXPECTED_COUNT__; actual integer; changed integer;
  protected_before jsonb; protected_after jsonb; preserved_students_before text; preserved_students_after text;
begin
  -- Direct membership is deliberate: admin_profile_is_admin depends on the caller's JWT.
  lock table private.admin_users in share mode;
  if jsonb_array_length(replacements) <> expected or (select count(distinct r.username)
    from jsonb_to_recordset(replacements) r(username text,password_hash text)) <> expected
    or exists(select 1 from jsonb_to_recordset(replacements) r(username text,password_hash text)
      where r.password_hash !~ '^\$2b\$10\$[./A-Za-z0-9]{53}$' or r.username is null or r.password_hash is null)
  then raise exception 'Invalid reset manifest'; end if;
  select count(*) into actual from public.profiles p
    where not exists(select 1 from private.admin_users a where a.user_id=p.id);
  if actual <> expected or exists(select 1 from public.profiles p
    where not exists(select 1 from private.admin_users a where a.user_id=p.id)
      and not exists(select 1 from jsonb_to_recordset(replacements) r(username text,password_hash text) where r.username=p.normalized_username))
  then raise exception 'Student roster changed since review'; end if;
  perform 1 from auth.users u join public.profiles p on p.id=u.id
    where not exists(select 1 from private.admin_users a where a.user_id=p.id) for update of u;
  if (select count(*) from auth.users u join public.profiles p on p.id=u.id
    where not exists(select 1 from private.admin_users a where a.user_id=p.id)
    and u.deleted_at is null and not u.is_sso_user and not u.is_anonymous) <> expected
  then raise exception 'Expected active password-login student accounts'; end if;

  select jsonb_build_object(
    'admins',(select md5(coalesce(jsonb_agg(to_jsonb(u) order by u.id),'[]'::jsonb)::text) from auth.users u
      where exists(select 1 from private.admin_users a where a.user_id=u.id)),
    'otherAuth',(select md5(coalesce(jsonb_agg(to_jsonb(u) order by u.id),'[]'::jsonb)::text) from auth.users u
      where not exists(select 1 from public.profiles p where p.id=u.id and not exists(select 1 from private.admin_users a where a.user_id=p.id))),
    'identities',(select md5(coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb)::text) from auth.identities i),
    'game',(select md5(jsonb_build_object('profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),
      'progress',(select jsonb_agg(to_jsonb(p) order by user_id) from public.player_progress p),
      'levels',(select jsonb_agg(to_jsonb(l) order by user_id,level) from public.level_progress l),
      'monitoring',(select jsonb_agg(to_jsonb(m) order by id) from public.parent_monitoring_observations m),
      'runs',(select jsonb_agg(to_jsonb(r) order by id) from public.jejak_aspect_runs r))::text))) into protected_before;
  select md5(jsonb_agg(to_jsonb(u)-array['encrypted_password','updated_at','confirmation_token','confirmation_sent_at',
    'recovery_token','recovery_sent_at','email_change_token_current','email_change_token_new','email_change_sent_at',
    'phone_change_token','phone_change_sent_at','reauthentication_token','reauthentication_sent_at'] order by u.id)::text)
    into preserved_students_before from auth.users u join public.profiles p on p.id=u.id
    where not exists(select 1 from private.admin_users a where a.user_id=p.id);

  update auth.users u set encrypted_password=r.password_hash, updated_at=clock_timestamp(),
    confirmation_token='',confirmation_sent_at=null,recovery_token='',recovery_sent_at=null,
    email_change_token_current='',email_change_token_new='',email_change_sent_at=null,
    phone_change_token='',phone_change_sent_at=null,reauthentication_token='',reauthentication_sent_at=null
    from public.profiles p join jsonb_to_recordset(replacements) r(username text,password_hash text)
      on r.username=p.normalized_username
    where u.id=p.id and not exists(select 1 from private.admin_users a where a.user_id=u.id);
  get diagnostics changed = row_count;
  if changed <> expected then raise exception 'Unexpected reset row count'; end if;
  delete from auth.one_time_tokens t using public.profiles p where t.user_id=p.id
    and not exists(select 1 from private.admin_users a where a.user_id=p.id);
  delete from auth.refresh_tokens t using public.profiles p where t.user_id=p.id::text
    and not exists(select 1 from private.admin_users a where a.user_id=p.id);
  perform private.revoke_user_sessions(p.id) from public.profiles p
    where not exists(select 1 from private.admin_users a where a.user_id=p.id);
  if (select count(*) from auth.users u join public.profiles p on p.id=u.id
    join jsonb_to_recordset(replacements) r(username text,password_hash text) on r.username=p.normalized_username
    where not exists(select 1 from private.admin_users a where a.user_id=p.id) and u.encrypted_password=r.password_hash) <> expected
    or exists(select 1 from auth.sessions s join public.profiles p on p.id=s.user_id where not exists(select 1 from private.admin_users a where a.user_id=p.id))
    or exists(select 1 from auth.refresh_tokens t join public.profiles p on p.id::text=t.user_id where not exists(select 1 from private.admin_users a where a.user_id=p.id))
    or exists(select 1 from auth.one_time_tokens t join public.profiles p on p.id=t.user_id where not exists(select 1 from private.admin_users a where a.user_id=p.id))
  then raise exception 'Reset or session revocation verification failed'; end if;

  select jsonb_build_object(
    'admins',(select md5(coalesce(jsonb_agg(to_jsonb(u) order by u.id),'[]'::jsonb)::text) from auth.users u
      where exists(select 1 from private.admin_users a where a.user_id=u.id)),
    'otherAuth',(select md5(coalesce(jsonb_agg(to_jsonb(u) order by u.id),'[]'::jsonb)::text) from auth.users u
      where not exists(select 1 from public.profiles p where p.id=u.id and not exists(select 1 from private.admin_users a where a.user_id=p.id))),
    'identities',(select md5(coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb)::text) from auth.identities i),
    'game',(select md5(jsonb_build_object('profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),
      'progress',(select jsonb_agg(to_jsonb(p) order by user_id) from public.player_progress p),
      'levels',(select jsonb_agg(to_jsonb(l) order by user_id,level) from public.level_progress l),
      'monitoring',(select jsonb_agg(to_jsonb(m) order by id) from public.parent_monitoring_observations m),
      'runs',(select jsonb_agg(to_jsonb(r) order by id) from public.jejak_aspect_runs r))::text))) into protected_after;
  select md5(jsonb_agg(to_jsonb(u)-array['encrypted_password','updated_at','confirmation_token','confirmation_sent_at',
    'recovery_token','recovery_sent_at','email_change_token_current','email_change_token_new','email_change_sent_at',
    'phone_change_token','phone_change_sent_at','reauthentication_token','reauthentication_sent_at'] order by u.id)::text)
    into preserved_students_after from auth.users u join public.profiles p on p.id=u.id
    where not exists(select 1 from private.admin_users a where a.user_id=p.id);
  if protected_before is distinct from protected_after or preserved_students_before is distinct from preserved_students_after
  then raise exception 'Unrelated account/game data changed; rollback'; end if;
end $$;
commit;
select count(*) student_count,count(distinct u.encrypted_password) distinct_salted_hashes
from auth.users u join public.profiles p on p.id=u.id
where not exists(select 1 from private.admin_users a where a.user_id=p.id);
