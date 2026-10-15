begin;

-- Stable curriculum mapping; each mission pair is worth six stars.
create or replace function private.character_aspects()
returns table (id text, character_id text, first_level integer, last_level integer)
language sql immutable security invoker set search_path = '' as $$
  values ('kejujuran','yudhistira',1,2), ('keberanian','bima',3,4),
    ('kesopanan','arjuna',5,6), ('kebijaksanaan','nakula',7,8), ('keadilan','sadewa',9,10)
$$;

-- Same 15-card answer key as src/game/data/jejakPandawa.ts. Each run samples
-- two cards per character. Original fine-grained content tags stay unchanged.
create or replace function private.jejak_aspect_cards()
returns table (card_id text, character_id text, good boolean)
language sql immutable security invoker set search_path = '' as $$
  values ('yudhistira-01','yudhistira',true), ('yudhistira-02','yudhistira',false), ('yudhistira-03','yudhistira',true),
    ('bima-01','bima',false), ('bima-02','bima',true), ('bima-03','bima',false),
    ('arjuna-01','arjuna',false), ('arjuna-02','arjuna',true), ('arjuna-03','arjuna',true),
    ('nakula-01','nakula',true), ('nakula-02','nakula',false), ('nakula-03','nakula',false),
    ('sadewa-01','sadewa',false), ('sadewa-02','sadewa',true), ('sadewa-03','sadewa',true)
$$;

create or replace function private.valid_character_scores(scores jsonb)
returns boolean language sql immutable security invoker set search_path = '' as $$
  select case when scores is null then true
    when jsonb_typeof(scores) <> 'object' then false
    else (select count(*) = 5 and bool_and(
      key in ('kejujuran','keberanian','kesopanan','kebijaksanaan','keadilan')
      and value in ('0'::jsonb,'1'::jsonb,'2'::jsonb)) from jsonb_each(scores)) end
$$;

alter table public.player_progress add column jejak_aspect_scores jsonb;
alter table public.player_progress add constraint player_progress_aspect_scores_valid
  check (private.valid_character_scores(jejak_aspect_scores));
comment on column public.player_progress.jejak_aspect_scores is
  'Best recorded score per character aspect (0..2). NULL means no detailed run recorded. Legacy total 0 or 10 is uniquely inferable; other totals must not be divided equally.';

create or replace function private.guard_jejak_aspect_scores()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.jejak_aspect_scores is not distinct from old.jejak_aspect_scores then return new; end if;
  if new.jejak_aspect_scores is null then
    new.jejak_aspect_scores := old.jejak_aspect_scores;
    return new;
  end if;
  if not new.jejak_pandawa_unlocked then
    raise exception using errcode = '23514', message = 'Jejak Pandawa is locked';
  end if;
  if not private.valid_character_scores(new.jejak_aspect_scores) then
    raise exception using errcode = '22023', message = 'Invalid character aspect scores';
  end if;
  select jsonb_object_agg(key, greatest(value::integer,
    coalesce((old.jejak_aspect_scores->>key)::integer,0),
    case when old.jejak_pandawa_best_score = 10 then 2 else 0 end))
    into new.jejak_aspect_scores from jsonb_each_text(new.jejak_aspect_scores);
  return new;
end
$$;
create trigger player_progress_guard_aspects before update of jejak_aspect_scores
on public.player_progress for each row execute function private.guard_jejak_aspect_scores();

create or replace function public.record_jejak_aspect_result(run_answers jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  scores jsonb;
  total smallint;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if jsonb_typeof(run_answers) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Expected ten Jejak answers';
  end if;
  if jsonb_array_length(run_answers) <> 10 or exists (
    select 1 from jsonb_array_elements(run_answers) as answer
    left join private.jejak_aspect_cards() as card on card.card_id = answer->>'cardId'
    where card.card_id is null or coalesce(answer->>'basket','') not in ('good','bad')
  ) or (select count(distinct answer->>'cardId') from jsonb_array_elements(run_answers) as answer) <> 10 then
    raise exception using errcode = '22023', message = 'Invalid Jejak answers';
  end if;
  if exists (
    select 1 from jsonb_array_elements(run_answers) as answer
    join private.jejak_aspect_cards() as card on card.card_id = answer->>'cardId'
    group by card.character_id having count(*) <> 2
  ) then
    raise exception using errcode = '22023', message = 'Expected two answers per aspect';
  end if;
  select jsonb_object_agg(aspect,score), sum(score)::smallint into scores,total from (
    select definition.id as aspect,
      count(*) filter (where (answer->>'basket' = 'good') = card.good)::integer as score
    from jsonb_array_elements(run_answers) as answer
    join private.jejak_aspect_cards() as card on card.card_id = answer->>'cardId'
    join private.character_aspects() as definition on definition.character_id = card.character_id
    group by definition.id
  ) as result;
  -- Locks the existing row, enforces unlock, and preserves the original best total.
  perform public.record_jejak_result(total);
  update public.player_progress set jejak_aspect_scores = scores where user_id = (select auth.uid());
  return public.read_complete_progress();
end
$$;

create or replace function public.admin_school_aspect_averages(school_name text default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if not (select private.is_admin()) then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;
  with students as (
    select profile.id, profile.school_name, coalesce(player.jejak_pandawa_best_score,0) as total,
      player.jejak_aspect_scores as scores
    from public.profiles as profile
    left join public.player_progress as player on player.user_id = profile.id
    where not private.admin_profile_is_admin(profile.id)
      and (admin_school_aspect_averages.school_name is null or profile.school_name = private.normalize_school_name(admin_school_aspect_averages.school_name))
  ), student_aspects as (
    select student.id,student.school_name,definition.id as aspect,definition.first_level,
      coalesce((select sum(level.stars) from public.level_progress as level
        where level.user_id = student.id and level.level between definition.first_level and definition.last_level),0) as mission,
      case when student.total = 10 then 2
        when student.scores is not null then (student.scores->>definition.id)::integer
        when student.total = 0 then 0 else null end as jejak
    from students as student cross join private.character_aspects() as definition
  ), averages as (
    select points.school_name,points.aspect,points.first_level,count(*)::integer as students,
      count(points.jejak)::integer as known,avg(points.mission) as mission,avg(points.jejak) as jejak
    from student_aspects as points group by points.school_name,points.aspect,points.first_level
  ), schools as (
    select aggregate.school_name,jsonb_build_object('schoolName',aggregate.school_name,'studentCount',max(aggregate.students),
      'jejakKnownCount',max(aggregate.known),'aspects',jsonb_agg(jsonb_build_object(
        'id',aggregate.aspect,'missionAverage',aggregate.mission,'jejakAverage',aggregate.jejak) order by aggregate.first_level)) as data
    from averages as aggregate group by aggregate.school_name
  ) select coalesce(jsonb_agg(schools.data order by schools.school_name),'[]'::jsonb) into result from schools;
  return result;
end
$$;

revoke all on function private.character_aspects(),private.jejak_aspect_cards(),private.valid_character_scores(jsonb),private.guard_jejak_aspect_scores() from public,anon;
grant execute on function private.character_aspects(),private.jejak_aspect_cards(),private.valid_character_scores(jsonb) to authenticated;
grant execute on function private.valid_character_scores(jsonb) to service_role;
revoke all on function public.record_jejak_aspect_result(jsonb),public.admin_school_aspect_averages(text) from public,anon;
grant execute on function public.record_jejak_aspect_result(jsonb),public.admin_school_aspect_averages(text) to authenticated;
notify pgrst,'reload schema';
commit;
